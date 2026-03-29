import type { Matrix } from "../geo/matrix";
import { newellNormal, windingOrder2D, type Plane } from "../geo/utils";
import type { Vector3 } from "../geo/vector";
import { Vertex } from "../geo/vector";
import { isNotNull } from "../utils/ts-util";
import { typeGuardByProperty, typeGuardPrimitive } from "../utils/typechecks";
import { Model } from "./model";

export type Material = {
    color?: string;
    opacity?: number;
};

type ExtrudeOptions = {
    holeSideFaces?: boolean;
    startCap?: boolean;
    endCap?: boolean;
    sideFaces?: boolean;
};

/**
 * Why ModelingPlane (instead of modeling in 3D)?
 * - it's closer to how we draw shapes on paper
 * - user doest't have to ensure polygons are planar
 * - it enables the windingOrder2D function which again enables using ModelingFace
 *   (we need to reverse order of points if ModelingFace is not corresponding to winding order)
 */
type ModelingPlane =
    | "LEFT"
    | "RIGHT"
    | "TOP"
    | "DOWN"
    | { orientation: "CUSTOM"; plane: Plane }
    | undefined;
/**
 * Why ModelingFace?
 * - it could assist spatial orientation while modeling
 * - it's more intuitive than winding order to indicate orientation (user could use any winding order)
 */
type ModelingFace = "BACK" | "FRONT" | undefined;

export type ShapeWithNormal = Shape & { _normal: Vector3 };

export type Point2 = [number, number] | { x: number; y: number };
export type Point3 =
    | [number, number, number]
    | { x: number; y: number; z: number };

type BaseGeometry = {
    x?: number;
    y?: number;
    z?: number;
};
type Rect2Geometry = {
    height: number;
    width: number;
} & BaseGeometry;
type Polygon2Geometry = {
    points: Point2[];
} & BaseGeometry;
type Polygon3Geometry = {
    points: Point3[];
} & BaseGeometry;

type Geometry3 = Polygon3Geometry & { type: "Polygon3" };
type Geometry2 =
    | (Polygon2Geometry & { type: "Polygon2" })
    | (Rect2Geometry & { type: "Rect2" });
type Geometry = Geometry3 | Geometry2;

type ShapeOptions = {
    id?: string;
    material?: Material;
    modelingPlane?: ModelingPlane;
    modelingFace?: ModelingFace;
};
export type Rect2Options = Rect2Geometry & {
    holes?: Geometry2[];
} & ShapeOptions;
export type Polygon2Options = Polygon2Geometry & {
    holes?: Geometry2[];
} & ShapeOptions;
export type Polygon3Options = Polygon3Geometry & {
    holes?: Geometry3[];
} & Exclude<ShapeOptions, "modelingPlane" | "modelingFace">;

let counter = 0;

export abstract class Shape {
    id: string;
    material: Material | undefined;
    modelingPlane: ModelingPlane | undefined;
    modelingFace: ModelingFace | undefined;

    _normal: Vector3 | undefined;
    _holePoints: Vertex[][] = []; // These are intersected (someday) and clipped, keep away from user

    private _points: Vertex[] = [];
    private _holes: Geometry[] = [];

    constructor(readonly type: string, options?: ShapeOptions) {
        this.id = options?.id ?? `${type}-${counter}`;
        this.material = options?.material;
        this.modelingPlane = options?.modelingPlane;
        this.modelingFace = options?.modelingFace;
        counter++;
    }

    get points() {
        return this._points;
    }

    set points(points: Vertex[]) {
        this._points = points;
        this._normal = newellNormal(points);
    }

    get holes() {
        return this._holes;
    }

    set holes(holes: Geometry[]) {
        this._holes = holes;

        // TODO post-mvp?: intersect holes

        this._holePoints = holes.map(hole =>
            geometryToVertices(hole, this.modelingPlane, this.modelingFace)
        );
    }

    transform(matrix: Matrix) {
        this.points = this.points.map(point => point.transform(matrix));
        this._holePoints = this._holePoints.map(array =>
            array.map(point => point.transform(matrix))
        );
        return this;
    }

    invert() {
        this.points = this.points.reverse();
        this._holePoints = this._holePoints.map(array => array.reverse());
        return this;
    }

    extrudeToModel(
        depth: number,
        id?: string,
        options?: ExtrudeOptions
    ): Model {
        return new Model({
            id,
            material: this.material,
            shapes: this.extrudeToShapes(depth, id, options),
        });
    }

    extrudeToShapes(
        depth: number,
        id?: string,
        options?: ExtrudeOptions
    ): Shape[] {
        // Just to avoid API confusion and ambiguity
        if (depth <= 0) {
            throw new Error("Extrusion depth should be a positive number");
        }

        const {
            holeSideFaces = true,
            startCap = true,
            endCap = true,
            sideFaces = true,
        } = options ?? {};

        // Drawing opposite direction of normal
        const depthVector = newellNormal(this.points)?.multiply(-depth);
        if (depthVector == null) throw new Error("invalid shape");

        const walls = createExtrudedWalls(
            this.points,
            depthVector,
            id ?? this.id,
            this.material
        );

        const backFace = new Polygon3({
            id: `${id ?? this.id}-back`,
            material: this.material,
            points: this.points.map(p => p.add(depthVector)).reverse(),
            holes: this._holePoints.map(holePoints => {
                const hole: Geometry3 = {
                    type: "Polygon3",
                    points: holePoints.map(p => p.add(depthVector)).reverse(),
                };
                return hole;
            }),
        });

        const holeWalls = this._holePoints.flatMap(holePoints =>
            createExtrudedWalls(
                holePoints,
                depthVector,
                id ?? this.id,
                this.material
            )
        );

        // TODO post-mvp: Do we need this when there's no other opt-in than evenodd?
        for (const w of holeWalls) w.points = w.points.reverse();

        const result = [];
        if (startCap) result.push(this);
        if (endCap) result.push(backFace);
        if (sideFaces) result.push(...walls);
        if (holeSideFaces) result.push(...holeWalls);

        return result;
    }

    /**
     * Toposort (both pointsAndBoundingPlaneCompare() and compareZ()) will sort flat models in front
     */
    toModel(id?: string): Model {
        return new Model({
            id,
            material: this.material,
            shapes: [this],
        });
    }

    abstract clone(options?: ShapeOptions): Shape;
}

/**
 * Drawing freely in 3D is sometimes more convenient than the 3D plane concept, eg:
 * - from/to drawing when filling gaps, eg. the third card in a "house of cards" triangle
 * - when calculating vertices based on other vertices, eg. the extrudeToModel() function
 */
export class Polygon3 extends Shape {
    private readonly _clonableOptions: Polygon3Options;

    constructor(options: Polygon3Options);
    constructor(...points: Point3[]);
    constructor(
        parameter: Polygon3Options | Point3 | undefined,
        ...parameterN: Point3[]
    ) {
        super(
            "Polygon3",
            typeGuardByProperty<Polygon3Options>(parameter, "material")
                ? parameter
                : undefined
        );
        this._clonableOptions = {
            ...(typeGuardByProperty<Polygon3Options>(parameter, "points")
                ? parameter
                : { points: [parameter, ...parameterN].filter(isNotNull) }),
        };

        const points = typeGuardByProperty<Polygon3Options>(parameter, "points")
            ? parameter.points
            : [parameter, ...parameterN].filter(isNotNull);

        this.points = geometryToVertices({
            type: "Polygon3",
            points,
            ...(typeGuardByProperty<Polygon3Options>(parameter, "points")
                ? parameter
                : {}),
        });

        this.holes = typeGuardByProperty<Polygon2Options>(parameter, "holes")
            ? positionHoles(parameter.holes ?? [], parameter) // TODO post-mvp: refactor - move the parent-relative positioning into set holes() and introduce internal position to Geometry (shapes and holes)
            : [];
    }

    clone(options?: Polygon3Options) {
        return new Polygon3({
            ...this._clonableOptions,
            material: this.material,
            ...options,
        });
    }
}

export class Polygon2 extends Shape {
    private readonly _clonableOptions: Polygon2Options;

    constructor(options: Polygon2Options);
    constructor(...points: Point2[]);
    constructor(
        parameter: Polygon2Options | Point2 | undefined,
        ...parameterN: Point2[]
    ) {
        super(
            "Polygon2",
            typeGuardByProperty<Polygon2Options>(parameter, "material")
                ? parameter
                : undefined
        );
        this._clonableOptions = {
            ...(typeGuardByProperty<Polygon2Options>(parameter, "points")
                ? parameter
                : { points: [parameter, ...parameterN].filter(isNotNull) }),
        };

        const points = typeGuardByProperty<Polygon2Options>(parameter, "points")
            ? parameter.points
            : [parameter, ...parameterN].filter(isNotNull);

        const modelingPlane = typeGuardByProperty<Polygon2Options>(
            parameter,
            "modelingPlane"
        )
            ? parameter.modelingPlane
            : undefined;
        const modelingFace = typeGuardByProperty<Polygon2Options>(
            parameter,
            "modelingFace"
        )
            ? parameter.modelingFace
            : undefined;

        this.points = geometryToVertices(
            {
                type: "Polygon2",
                points,
                ...(typeGuardByProperty<Polygon2Options>(parameter, "points")
                    ? parameter
                    : {}),
            },
            modelingPlane,
            modelingFace
        );

        this.holes = typeGuardByProperty<Polygon2Options>(parameter, "holes")
            ? positionHoles(parameter.holes ?? [], parameter)
            : [];
    }

    clone(options?: Polygon2Options) {
        return new Polygon2({
            ...this._clonableOptions,
            material: this.material,
            ...options,
        });
    }
}

export class Rect2 extends Shape {
    private readonly _clonableOptions: Rect2Options;

    constructor(options: Rect2Options) {
        super("Rect2", options);
        this._clonableOptions = options;

        this.points = geometryToVertices(
            { type: "Rect2", ...options },
            options.modelingPlane,
            options.modelingFace
        );

        this.holes = positionHoles(options.holes ?? [], options);
    }

    clone(options?: Rect2Options) {
        return new Rect2({
            ...this._clonableOptions,
            material: this.material,
            ...options,
        });
    }
}

const toVertices = (geometry: Geometry): Vertex[] => {
    switch (geometry.type) {
        case "Rect2": {
            const { width, height } = geometry;

            // prettier-ignore
            return Vertex.from([
                0, 0, 0,
                 width, 0, 0,
                 width,  height, 0,
                0,  height, 0
            ], 3);
        }

        case "Polygon2": {
            const { points } = geometry;

            return points.map(
                point =>
                    new Vertex(
                        Array.isArray(point) ? point[0] : point.x,
                        Array.isArray(point) ? point[1] : point.y,
                        0
                    )
            );
        }

        case "Polygon3": {
            const { points } = geometry;

            return points.map(
                point =>
                    new Vertex(
                        Array.isArray(point) ? point[0] : point.x,
                        Array.isArray(point) ? point[1] : point.y,
                        Array.isArray(point) ? point[2] : point.z
                    )
            );
        }

        // No default
    }
};

const positionVertices = (
    vertices: Vertex[],
    x = 0,
    y = 0,
    z = 0
): Vertex[] => {
    return vertices.map(
        vertex => new Vertex(vertex.x + x, vertex.y + y, vertex.z + z)
    );
};

const planeAdjustVertices = (
    points: Vertex[],
    modelingPlane: ModelingPlane
): Vertex[] => {
    const orientation = typeGuardPrimitive(modelingPlane)
        ? modelingPlane
        : modelingPlane?.orientation;

    switch (orientation) {
        case "LEFT":
            return points.map(p => new Vertex(p.z, p.y, -p.x));

        case "RIGHT":
            return points.map(p => new Vertex(-p.z, p.y, p.x));

        case "TOP":
            return points.map(p => new Vertex(p.x, p.z, p.y));

        case "DOWN":
            return points.map(p => new Vertex(p.x, -p.z, -p.y));

        case "CUSTOM": {
            const { plane } = modelingPlane as {
                orientation: "CUSTOM";
                plane: Plane;
            };
            return points.map(p => p.subtract(plane.unitNormal.multiply(p.z)));
        }

        case undefined:
            return points;

        // No default
    }
};

const geometryToVertices = (
    geometry: Geometry,
    modelingPlane?: ModelingPlane,
    modelingFace?: ModelingFace
) => {
    const vertices = toVertices(geometry);

    const positionedVertices = positionVertices(
        vertices,
        geometry.x,
        geometry.y,
        geometry.z
    );

    const isGeo2 = geometry.type === "Rect2" || geometry.type === "Polygon2";

    if (
        isGeo2 &&
        (windingOrder2D(positionedVertices) === "CCW") ===
            (modelingFace === "BACK")
    ) {
        positionedVertices.reverse();
    }

    return planeAdjustVertices(positionedVertices, modelingPlane);
};

const positionHoles = (holes: Geometry[], parent: BaseGeometry) => {
    return holes.map(hole => ({
        ...hole,
        ...(parent.x == null ? {} : { x: (hole.x ?? 0) + parent.x }),
        ...(parent.y == null ? {} : { y: (hole.y ?? 0) + parent.y }),
        ...(parent.z == null ? {} : { z: (hole.z ?? 0) + parent.z }),
    }));
};

const createExtrudedWalls = (
    points: Vertex[],
    depthVector: Vector3,
    baseId: string,
    material: Material | undefined
): Shape[] => {
    return points.length > 1
        ? points.map((p, i, array) => {
              const pNext = array[(i + 1) % array.length];
              const pDepth = p.add(depthVector);
              const pDepthNext = pNext.add(depthVector);

              return new Polygon3({
                  id: `${baseId}-wall-${i}`,
                  material,
                  points: [p, pDepth, pDepthNext, pNext],
              });
          })
        : [];
};
