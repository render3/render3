import { shape_color, shape_light } from "../core/default-impl";
import type { Scene } from "../scene/scene";
import type { FrameBuffer } from "../core/framebuffer";
import { DomNamespace } from "../types/dom";
import { isNotNull } from "../utils/ts-util";
import type { SpaceKey } from "../types/spaces";
import { Matrix } from "../geo/matrix";
import { defaultViewport } from "../scene/camera";
import type { DomNodeDefinition } from "./pipeline-types";
import { HtmlDivContainer } from "./htmldiv-container";
import type { RendererInputOptions } from "./renderer";

/**
 * This renderer is using MVP matrix to obtain same output as fullscale renderers.
 * Using the MVP matrix gives us more control over the projection and 3D space, but it also
 * requires us to handle depth sorting manually.
 *
 * There is a way to have (GPU) depth sorting provided by the browser, but that would require us
 * to use the modelView matrix and accept a more simplistic and linear projection system provided
 * by the browser, making it hard to set a correct perspective attribute and scale objects correctly.
 * It would also require us to define transformations by arrays of each single transform instead of
 * single matrices of computed transformations.
 */
export class SVGCSSTransformRenderer extends HtmlDivContainer<DomNamespace.SVG> {
    override readonly pipelineTarget: SpaceKey = "PROJECTION"; // eslint-disable-line @typescript-eslint/class-literal-property-style

    constructor(options?: Partial<RendererInputOptions>) {
        super(DomNamespace.SVG, options?.domElement, {
            viewport: options?.viewport ?? defaultViewport,
            vsd: {
                culling: {
                    "frustum-side": true,
                    "frustum-far": true,
                    backface: options?.backfaceCulling ?? false,
                },
            },
        });

        // TODO mvp: don't overwrite existing attrs on domElement (see svg-container.ts)
        this.domElement.style.width = `${this.config.viewport.width}${
            this.config.viewport.unit ?? "px"
        }`;
        this.domElement.style.height = `${this.config.viewport.height}${
            this.config.viewport.unit ?? "px"
        }`;
    }

    override toDom(
        scene: Scene,
        frameBuffer: FrameBuffer
    ): Array<DomNodeDefinition<DomNamespace.SVG>> {
        const { viewport } = this.config;

        if (scene.background) {
            this.domElement.style.backgroundColor = scene.background;
        }

        return (
            frameBuffer
                .models()
                .map(m => m.PROJECTION) // Get models with projection data
                .filter(isNotNull)
                .flatMap(modelBuffer => {
                    const { geo, modelFrameBuffer } = modelBuffer;
                    const { mvpMatrix, shapes } = geo;

                    return shapes
                        .filter(shapeGeo => shapeGeo.vertexIndices.length) // Clipping might remove all points on a shape
                        .map(shapeGeo => {
                            const material =
                                shapeGeo.shape.material ??
                                modelFrameBuffer.model.material ??
                                {};

                            const usePath = shapeGeo.shape._holePoints.length;

                            return {
                                elementDescriptor: {
                                    tag: usePath ? "path" : "polygon",
                                },
                                elementWrappers: [
                                    {
                                        tag: "svg",
                                        style: {
                                            position: "absolute",
                                            left: "0",
                                            top: "0",
                                            transformOrigin: "0px 0px", // Data2D origin, see offsetXY
                                        },
                                        attributes: {
                                            width: String(
                                                shapeGeo.LOCAL.data2D.width
                                            ),
                                            height: String(
                                                shapeGeo.LOCAL.data2D.height
                                            ),
                                        },
                                    },
                                ],
                                fillElement(element) {
                                    element.setAttribute(
                                        "id",
                                        shapeGeo.shape.id
                                    );

                                    if (usePath) {
                                        element.setAttribute(
                                            "fill-rule",
                                            "evenodd"
                                        );

                                        element.setAttribute(
                                            "d",
                                            shapeGeo.LOCAL.data2D.vertices
                                                .map(
                                                    (point, i) =>
                                                        `${
                                                            i === 0
                                                                ? "M "
                                                                : "L "
                                                        }${point.x} ${point.y}`
                                                )
                                                .join(" ") +
                                                " Z" +
                                                shapeGeo.LOCAL.data2D.holes
                                                    .map(
                                                        hole =>
                                                            hole
                                                                .map(
                                                                    (
                                                                        holePoint,
                                                                        i
                                                                    ) =>
                                                                        `${
                                                                            i ===
                                                                            0
                                                                                ? " M "
                                                                                : "L "
                                                                        }${
                                                                            holePoint.x
                                                                        } ${
                                                                            holePoint.y
                                                                        }`
                                                                )
                                                                .join(" ") +
                                                            " Z"
                                                    )
                                                    .join("")
                                        );
                                    } else {
                                        // The local-space shapes don't change, but the provided element might have belonged to a different shape in the previous render.
                                        element.setAttribute(
                                            "points",
                                            shapeGeo.LOCAL.data2D.vertices
                                                .map(
                                                    point =>
                                                        `${point.x},${point.y}`
                                                ) // We can't invert y here as that causes different y direction for point coords and transform matrix
                                                .join(" ")
                                        );
                                    }

                                    if (element.ownerSVGElement) {
                                        element.ownerSVGElement.style.transform = `matrix3d(${
                                            // prettier-ignore
                                            Matrix.translate({ x: viewport.width / 2, y: viewport.height / 2 }) // ViewBox
                                                .multiply(Matrix.viewport(viewport)) // TODO post-mvp: Why not camera.viewport.matrix?
                                                .multiply(Matrix.flip({ y: true }))
                                                .multiply(mvpMatrix)
                                                .multiply(shapeGeo.LOCAL.data2D.matrix3D)
                                                .transpose() // From row-major to column-major
                                                .toString()
                                        })`;
                                    }

                                    const shapeColor = shape_color(
                                        material,
                                        shape_light(
                                            shapeGeo.WORLD.modelNormal,
                                            scene.ambientLight,
                                            scene.directionalLight
                                        )
                                    );

                                    if (shapeColor) {
                                        element.setAttribute(
                                            "fill",
                                            shapeColor
                                        );
                                    }

                                    if (material.opacity != null) {
                                        element.setAttribute(
                                            "opacity",
                                            String(material.opacity)
                                        );
                                    }
                                },
                                clearElement(element) {
                                    element.removeAttribute("d");
                                    element.removeAttribute("points");
                                },
                            };
                        });
                }) ?? []
        );
    }
}
