import { shapeNormal } from "../core/default-impl";
import type { ShapeFrameBuffer } from "../core/framebuffer";
import { lerp } from "../geo/utils";
import type { Vector3, Vertex } from "../geo/vector";
import { previousArrayItem } from "../utils/utils";
import { EPSILON } from "../core/constants";
import type { ShapeWithNormal } from "./shape";

type BSPShape = {
    originalShape: ShapeWithNormal;
    shape: ShapeWithNormal;
    front?: BSPShape;
    back?: BSPShape;
};

export class BSP {
    readonly shapes: ShapeWithNormal[] = [];
    private readonly root: BSPShape | undefined;

    constructor(shapes?: ShapeWithNormal[]) {
        if (shapes == null) return;
        if (shapes.length === 0) return;

        this.shapes.push(shapes[0]);
        this.root = {
            originalShape: shapes[0],
            shape: shapes[0],
        };

        for (const shape of shapes.slice(1)) {
            const bspShape: BSPShape = {
                originalShape: shape,
                shape,
            };
            insertShape(this.root, bspShape, bspShape =>
                this.shapes.push(bspShape.shape)
            );
        }
    }

    sort(shapeMap: Map<ShapeWithNormal, ShapeFrameBuffer>): ShapeFrameBuffer[] {
        const result: ShapeFrameBuffer[] = [];

        (function dfs(node: BSPShape | undefined) {
            if (node == null) return;

            const shapeFrame = shapeMap.get(node.shape);

            if (shapeFrame == null) {
                throw new Error("All shapes are needed to traverse tree");
            }

            dfs(shapeFrame?.EYE.isBackFacing ? node.front : node.back);
            result.push(shapeFrame);
            dfs(shapeFrame?.EYE.isBackFacing ? node.back : node.front);
        })(this.root);

        return result;
    }
}

function insertShape(
    node: BSPShape,
    shape: BSPShape,
    onInsert: (shape: BSPShape) => void
): void {
    const side = compare(node, shape);

    switch (side) {
        case "front": {
            if (node.front) {
                insertShape(node.front, shape, onInsert);
            } else {
                node.front = shape;
                onInsert(shape);
            }

            break;
        }

        case "back": {
            if (node.back) {
                insertShape(node.back, shape, onInsert);
            } else {
                node.back = shape;
                onInsert(shape);
            }

            break;
        }

        case "intersecting": {
            const [frontShape, backShape] = split(node, shape);

            // TODO post-mvp: centralize validation with Model.addShapes()
            if (shapeNormal(frontShape.shape)) {
                if (node.front) {
                    insertShape(node.front, frontShape, onInsert);
                } else {
                    node.front = frontShape;
                    onInsert(frontShape);
                }
            }

            // TODO post-mvp: centralize validation with Model.addShapes()
            if (shapeNormal(backShape.shape)) {
                if (node.back) {
                    insertShape(node.back, backShape, onInsert);
                } else {
                    node.back = backShape;
                    onInsert(backShape);
                }
            }

            break;
        }
        // No default
    }
}

const compare = (
    plane: BSPShape,
    bspShape: BSPShape
): "front" | "back" | "intersecting" => {
    const allDots = bspShape.shape.points.map(point =>
        point.subtract(plane.shape.points[0]).dot(plane.shape._normal)
    );

    if (allDots.every(d => d >= -EPSILON)) {
        return "front";
    }

    if (allDots.every(d => d <= EPSILON)) {
        return "back";
    }

    return "intersecting";
};

const split = (plane: BSPShape, bspShape: BSPShape): [BSPShape, BSPShape] => {
    const frontShape: BSPShape = {
        originalShape: bspShape.originalShape,
        shape: bspShape.shape.clone() as ShapeWithNormal,
    };

    const backShape: BSPShape = {
        originalShape: bspShape.originalShape,
        shape: bspShape.shape.clone() as ShapeWithNormal,
    };

    const [plusShape, minusShape] = splitPoints(
        bspShape.shape.points,
        plane.shape.points[0],
        plane.shape._normal
    );

    const holePairs = bspShape.shape._holePoints.map(hole =>
        splitPoints(hole, plane.shape.points[0], plane.shape._normal)
    );

    frontShape.shape.points = plusShape;
    frontShape.shape._holePoints = holePairs.map(pair => pair[0]);
    frontShape.shape.id += `-splitby[${plane.shape.id}]-front`;

    backShape.shape.points = minusShape;
    backShape.shape._holePoints = holePairs.map(pair => pair[1]);
    backShape.shape.id += `-splitby[${plane.shape.id}]-back`;

    return [frontShape, backShape];
};

const splitPoints = (
    points: Vertex[],
    planePoint: Vertex,
    planeNormal: Vector3
) => {
    const plusShape: Vertex[] = [];
    const minusShape: Vertex[] = [];

    let previousPoint = previousArrayItem(points, 0);
    let previousDot = previousPoint.subtract(planePoint).dot(planeNormal);

    for (const point of points) {
        const dot = point.subtract(planePoint).dot(planeNormal);

        // Intersection
        if (previousDot * dot < 0) {
            const intersection = lerp(
                previousPoint,
                point,
                Math.abs(previousDot) / (Math.abs(previousDot) + Math.abs(dot))
            ).asVertex();

            plusShape.push(intersection);
            minusShape.push(intersection);
        }

        if (dot >= 0) {
            plusShape.push(point);
        }

        if (dot <= 0) {
            minusShape.push(point);
        }

        previousPoint = point;
        previousDot = dot;
    }

    return [plusShape, minusShape];
};
