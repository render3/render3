import { OrthographicCamera, type Camera } from "../scene/camera";
import type { SpaceKey } from "../types/spaces";
import type { Scene } from "../scene/scene";
import { Model } from "../scene/model";
import { getAllNested, previousArrayItem } from "../utils/utils";
import { isPlaneBackFacing, lerp } from "../geo/utils";
import { Matrix } from "../geo/matrix";
import type { Vector } from "../geo/vector";
import { Vector3, Vertex } from "../geo/vector";
import type { RendererConfig } from "../renderers/renderer";
import { Bounding } from "../scene/bounding";
import { ArrayLazyMap } from "./framebuffer";
import type {
    FrameBuffer,
    ObjectFrameBuffer,
    Shape2D,
    ShapeFrameBuffer,
} from "./framebuffer";
import { FRUSTUM_NEAR, vectorPlanePosition } from "./frustum-culling";

export const calculateSpaceInBuffer = <S extends SpaceKey>(
    space: S,
    scene: Scene,
    camera: Camera,
    buffer: FrameBuffer,
    config: RendererConfig
): void => {
    const models = scene.children.flatMap(model =>
        getAllNested(model, model => model.children)
    );

    switch (space) {
        case "LOCAL": {
            for (const model of models) {
                // TODO post-mvp: perf - replace with a boolean telling if model has changed.
                if (buffer.has(model)) continue;

                const modelVertices: Vertex[] = [];
                const shapes = model._bsp?.shapes.map(shape => {
                    const vertexIndices = fillVertexArray(
                        modelVertices,
                        shape.points
                    );
                    const holeVertexIndices = fillVertexArrayNested(
                        modelVertices,
                        shape._holePoints
                    );

                    return {
                        shape,
                        vertexIndices,
                        holeVertexIndices,

                        LOCAL: {
                            data2D: new Data2D(
                                shape.points,
                                shape._holePoints,
                                shape._normal
                            ),
                        },
                        WORLD: {
                            get modelNormal(): Vector {
                                throw new Error(
                                    "World space is not calculated"
                                );
                            },
                        },
                        EYE: {
                            get modelViewNormal(): Vector {
                                throw new Error("Eye space is not calculated");
                            },
                            get isBackFacing(): boolean {
                                throw new Error("Eye space is not calculated");
                            },
                        },
                    };
                });

                const modelFrameBuffer: ObjectFrameBuffer = {
                    ...(model instanceof Model
                        ? {
                              kind: "model",
                              model,
                          }
                        : { kind: "group", model }), // TODO mvp: camera becomes group here?

                    LOCAL: {
                        get modelFrameBuffer() {
                            return modelFrameBuffer;
                        },
                        geo: {
                            vertices: {
                                array: modelVertices,
                            },
                            bounding: new Bounding(modelVertices),
                            shapes: shapes ?? [], // TODO post-mvp: ISSUE_shapes_and_vertices_in_group
                        },
                    },
                };
                buffer.add(model, modelFrameBuffer);
            }

            break;
        }

        case "WORLD": {
            buffer.bufferModelsCallback(
                models,
                (model, modelFrameBuffer, parentModelBuffer) => {
                    const sceneGraphModelMatrix = parentModelBuffer?.WORLD
                        ? // 2) then transform it in parent's space
                          parentModelBuffer.WORLD.geo.modelMatrix.multiply(
                              // 1) model transform in its own space
                              model.modelMatrix
                          )
                        : model.modelMatrix;

                    const sceneGraphModelNormalMatrix = parentModelBuffer?.WORLD
                        ? parentModelBuffer.WORLD.geo.modelNormalMatrix.multiply(
                              model.rotation.matrix
                          )
                        : model.rotation.matrix;

                    modelFrameBuffer.WORLD = {
                        modelFrameBuffer,
                        geo: {
                            vertices: new ArrayLazyMap(
                                modelFrameBuffer.LOCAL.geo.vertices,
                                v => v.transform(sceneGraphModelMatrix)
                            ),
                            bounding:
                                modelFrameBuffer.LOCAL.geo.bounding.transform(
                                    sceneGraphModelMatrix,
                                    sceneGraphModelNormalMatrix
                                ),
                            modelMatrix: sceneGraphModelMatrix,
                            modelNormalMatrix: sceneGraphModelNormalMatrix,

                            shapes: modelFrameBuffer.LOCAL.geo.shapes.map(
                                shapeGeo => {
                                    shapeGeo.WORLD = {
                                        modelNormal:
                                            shapeGeo.shape._normal.transform(
                                                sceneGraphModelNormalMatrix
                                            ),
                                    };

                                    return shapeGeo;
                                }
                            ),
                        },
                    };
                }
            );

            break;
        }

        case "EYE": {
            buffer.bufferModelsCallback(models, (model, modelFrameBuffer) => {
                if (modelFrameBuffer.WORLD == null) {
                    throw new Error("World space is not calculated");
                }

                const worldCamera = buffer.get(camera)?.WORLD;

                if (worldCamera == null) {
                    throw new Error("Camera not found in World space");
                }

                // View matrix
                const cameraModelMatrix = camera.getModelMatrix(
                    worldCamera.geo.modelMatrix
                );
                const cameraModelNormalMatrix =
                    worldCamera.geo.modelNormalMatrix.transpose(); // Rotation-only matrix is orthogonal meaning the inverse and transpose matrix are same

                const modelViewMatrix = cameraModelMatrix.multiply(
                    modelFrameBuffer.WORLD.geo.modelMatrix
                );

                /**
                 * Inversing matrices is a costly operation. [https://learnopengl.com/Lighting/Basic-Lighting]
                 * Additionally, if the transform (modelViewMatrix) has scaling, the normal vector must be re-normalized (after transformed by modelViewNormalMatrix) to make it unit length. [http://www.songho.ca/opengl/gl_normaltransform.html]
                 */
                /*
                        modelViewNormalMatrix = modelViewMatrix
                            .inverse()
                            .transpose();
                    */

                // Instead we use the camera's rotation to make the modelViewNormalMatrix

                const modelViewNormalMatrix = cameraModelNormalMatrix.multiply(
                    modelFrameBuffer.WORLD.geo.modelNormalMatrix
                );

                const shapesMap = new Map(
                    modelFrameBuffer.WORLD.geo.shapes.map(shapeGeo => {
                        const modelViewNormal =
                            shapeGeo.shape._normal.transform(
                                modelViewNormalMatrix
                            );

                        const isBackFacing = isPlaneBackFacing(
                            modelViewNormal,
                            camera.settings.type === "perspective"
                                ? modelFrameBuffer.LOCAL.geo.vertices.array[
                                      shapeGeo.vertexIndices[0]
                                  ]
                                      .transform(modelViewMatrix)
                                      .multiply(-1) // // Same as camera(0,0,0).subtract(planePoint.point)
                                : OrthographicCamera.directionToCamera
                        );

                        shapeGeo.EYE = {
                            modelViewNormal,
                            isBackFacing,
                        };

                        return [shapeGeo.shape, shapeGeo];
                    })
                );

                const shapes = model._bsp?.sort(shapesMap);

                modelFrameBuffer.EYE = {
                    modelFrameBuffer,
                    geo: {
                        vertices: new ArrayLazyMap(
                            modelFrameBuffer.LOCAL.geo.vertices,
                            v => v.transform(modelViewMatrix)
                        ),
                        bounding: modelFrameBuffer.LOCAL.geo.bounding.transform(
                            modelViewMatrix,
                            modelViewNormalMatrix
                        ),
                        modelViewMatrix,
                        modelViewNormalMatrix,

                        // Culling
                        shapes:
                            shapes?.filter(shapeGeo => {
                                if (!config.vsd.culling?.backface) {
                                    return true;
                                }

                                return !shapeGeo.EYE.isBackFacing;
                            }) ?? [], // TODO post-mvp: ISSUE_shapes_and_vertices_in_group
                    },
                };
            });

            break;
        }

        case "PROJECTION": {
            buffer.bufferModelsCallback(models, (model, modelFrameBuffer) => {
                if (modelFrameBuffer.EYE == null) {
                    throw new Error("Eye space is not calculated");
                }

                const mvpMatrix = camera.projectionMatrix.multiply(
                    modelFrameBuffer.EYE.geo.modelViewMatrix
                );

                modelFrameBuffer.PROJECTION = {
                    modelFrameBuffer,
                    geo: {
                        vertices: new ArrayLazyMap(
                            modelFrameBuffer.LOCAL.geo.vertices,
                            v => v.transform(mvpMatrix)
                        ),
                        get bounding(): Bounding {
                            throw new Error(
                                "Bounding is not provided in projection space"
                            );
                        },
                        mvpMatrix,

                        shapes: modelFrameBuffer.EYE.geo.shapes,
                    },
                };
            });
            break;
        }

        case "CLIP": {
            buffer.bufferModelsCallback(models, (model, modelFrameBuffer) => {
                if (modelFrameBuffer.PROJECTION == null) {
                    throw new Error("Projection space is not calculated");
                }

                const modelVertices =
                    modelFrameBuffer.PROJECTION.geo.vertices.array;
                const newModelVertices: Vertex[] = [];

                const clippedShapes: ShapeFrameBuffer[] =
                    modelFrameBuffer.PROJECTION.geo.shapes.map(shapeGeo => {
                        const shapeVertices = shapeGeo.vertexIndices.map(
                            i => modelVertices[i]
                        );

                        const clippedVertexIndices = clipAndFillVertexArray(
                            newModelVertices,
                            shapeVertices
                        );

                        const holeVertices = shapeGeo.holeVertexIndices.map(
                            hole => hole.map(i => modelVertices[i])
                        );

                        const clippedHoleVertexIndices =
                            clipAndFillVertexArrayNested(
                                newModelVertices,
                                holeVertices
                            );

                        return {
                            ...shapeGeo,
                            vertexIndices: clippedVertexIndices,
                            holeVertexIndices: clippedHoleVertexIndices,
                        };
                    });

                modelFrameBuffer.CLIP = {
                    modelFrameBuffer,
                    geo: {
                        vertices: {
                            array: newModelVertices,
                        },
                        get bounding(): Bounding {
                            throw new Error(
                                "Bounding is not provided in clip space"
                            );
                        },
                        shapes: clippedShapes,
                    },
                };
            });

            break;
        }

        case "NDC": {
            buffer.bufferModelsCallback(models, (model, modelFrameBuffer) => {
                if (modelFrameBuffer.CLIP == null) {
                    throw new Error("Clip space is not calculated");
                }

                modelFrameBuffer.NDC = {
                    modelFrameBuffer,
                    geo: {
                        vertices: {
                            array: modelFrameBuffer.CLIP?.geo.vertices.array.map(
                                vertex =>
                                    new Vertex(
                                        vertex.x / vertex.w,
                                        vertex.y / vertex.w,
                                        vertex.z / vertex.w
                                    )
                            ),
                        },
                        get bounding(): Bounding {
                            throw new Error(
                                "Bounding is not provided in ndc space"
                            );
                        },
                        shapes: modelFrameBuffer.CLIP.geo.shapes,
                    },
                };
            });

            break;
        }

        case "SCREEN": {
            buffer.bufferModelsCallback(models, (model, modelFrameBuffer) => {
                if (modelFrameBuffer.NDC == null) {
                    throw new Error("NDC space is not calculated");
                }

                modelFrameBuffer.SCREEN = {
                    modelFrameBuffer,
                    geo: {
                        vertices: new ArrayLazyMap(
                            modelFrameBuffer.NDC.geo.vertices,
                            v => v.transform(camera.viewport.matrix)
                        ),
                        get bounding(): Bounding {
                            throw new Error(
                                "Bounding is not provided in screen space"
                            );
                        },
                        shapes: modelFrameBuffer.NDC.geo.shapes,
                    },
                };
            });

            break;
        }
        // No default
    }
};

const fillVertexArray = (target: Vertex[], source: Vertex[]) => {
    return source.map(vertex => {
        const existingVertexIndex = target.findIndex(value => {
            return value.equals(vertex);
        });
        if (existingVertexIndex >= 0) {
            return existingVertexIndex;
        }

        const vertexClone = vertex.clone();
        target.push(vertexClone);
        return target.length - 1;
    });
};

const fillVertexArrayNested = (target: Vertex[], source: Vertex[][]) => {
    return source.map(nestedSource => {
        return fillVertexArray(target, nestedSource);
    });
};

const clipAndFillVertexArray = (target: Vertex[], shapeVertices: Vertex[]) => {
    const clippedVertexIndices: number[] = [];

    let vectorFrom = previousArrayItem(shapeVertices, 0);
    for (const vectorTo of shapeVertices) {
        const fromDot = vectorPlanePosition(vectorFrom, FRUSTUM_NEAR);
        const toDot = vectorPlanePosition(vectorTo, FRUSTUM_NEAR);

        // Add intersection
        if (
            (fromDot.position === "INSIDE" && toDot.position === "OUTSIDE") ||
            (fromDot.position === "OUTSIDE" && toDot.position === "INSIDE")
        ) {
            const alpha =
                fromDot.dotProduct / (fromDot.dotProduct - toDot.dotProduct);

            // Parametric line clipping
            const intersection = lerp(vectorFrom, vectorTo, alpha);

            clippedVertexIndices.push(
                ...fillVertexArray(target, [intersection])
            );
        }

        // Add valid vectorTo
        if (toDot.position === "INSIDE" || toDot.position === "PLANE") {
            clippedVertexIndices.push(...fillVertexArray(target, [vectorTo]));
        }

        vectorFrom = vectorTo;
    }

    return clippedVertexIndices;
};

const clipAndFillVertexArrayNested = (
    target: Vertex[],
    shapeVertices: Vertex[][]
) => {
    return shapeVertices.map(nestedShapeVertices => {
        return clipAndFillVertexArray(target, nestedShapeVertices);
    });
};

// SVGCSSTransformRenderer uses 2D coordinates (+ matrix3D attr), so we need to transform
// 3D vertices to 2D vertices (get vertices()) + 3D transform matrix (get matrix3D())
class Data2D implements Shape2D {
    // Public getters
    private _vertices: Vertex[] | undefined;
    private _holes: Vertex[][] | undefined;
    private _matrix3D: Matrix | undefined;
    private _width: number | undefined;
    private _height: number | undefined;

    // Internal
    private _xyRotationMatrix: Matrix | undefined;
    private _toXY: Matrix | undefined;
    private _toXYZ: Matrix | undefined;
    private _offsetXY: Vector | undefined;
    private _vertices2D: Vertex[] | undefined;

    constructor(
        private readonly vertices3D: Vertex[],
        private readonly holes3D: Vertex[][],
        private readonly normal: Vector
    ) {}

    private get xyRotationMatrix() {
        if (this._xyRotationMatrix) return this._xyRotationMatrix;
        const dot = new Vector3(0, 0, -1).dot(this.normal);
        const angleRadians = Math.acos(dot);
        const angleDegrees = angleRadians * (180 / Math.PI);

        const { x, y, z } = new Vector3(0, 0, -1).cross(this.normal); // Rotation axis
        this._xyRotationMatrix =
            x === 0 && y === 0
                ? Matrix.identity
                : Matrix.rotate({ angle: angleDegrees, x, y, z });
        return this._xyRotationMatrix;
    }

    private get toXY() {
        if (this._toXY) return this._toXY;
        const translateMatrix = Matrix.translate(
            this.vertices3D[0].multiply(-1)
        );
        this._toXY = this.xyRotationMatrix
            .transpose()
            .multiply(translateMatrix);
        return this._toXY;
    }

    private get toXYZ() {
        if (this._toXYZ) return this._toXYZ;
        const translateMatrix = Matrix.translate(this.vertices3D[0]);
        this._toXYZ = translateMatrix.multiply(this.xyRotationMatrix);
        return this._toXYZ;
    }

    // Used to move shape to CSS's transformOrigin 0,0
    private get offsetXY() {
        if (this._offsetXY) return this._offsetXY;
        this._offsetXY = new Vector3(
            Math.min(...this.vertices2D.map(v => v.x)),
            Math.min(...this.vertices2D.map(v => v.y)),
            Math.min(...this.vertices2D.map(v => v.z)) // Should be (close to) 0
        );
        return this._offsetXY;
    }

    private get vertices2D() {
        if (this._vertices2D) return this._vertices2D;
        this._vertices2D = this.vertices3D.map(v => v.transform(this.toXY));
        return this._vertices2D;
    }

    // 2D vertices (z=0)
    get vertices() {
        if (this._vertices) return this._vertices;
        if (this.vertices3D.length === 0) return [];

        this._vertices = this.vertices2D.map(v =>
            v.transform(Matrix.translate(this.offsetXY.multiply(-1)))
        );

        return this._vertices;
    }

    get holes() {
        if (this._holes) return this._holes;
        if (this.holes3D.length === 0) return [];

        this._holes = this.holes3D.map(hole =>
            hole.map(v =>
                v
                    .transform(this.toXY)
                    .transform(Matrix.translate(this.offsetXY.multiply(-1)))
            )
        );

        return this._holes;
    }

    get matrix3D() {
        if (this._matrix3D) return this._matrix3D;
        if (this.vertices3D.length === 0) return Matrix.identity;
        this._matrix3D = this.toXYZ.multiply(Matrix.translate(this.offsetXY));
        return this._matrix3D;
    }

    get width() {
        if (this._width) return this._width;
        this._width =
            Math.max(...this.vertices.map(v => v.x)) -
            Math.min(...this.vertices.map(v => v.x));
        return this._width;
    }

    get height() {
        if (this._height) return this._height;
        this._height =
            Math.max(...this.vertices.map(v => v.y)) -
            Math.min(...this.vertices.map(v => v.y));
        return this._height;
    }
}
