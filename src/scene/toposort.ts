/* eslint-disable complexity */
import { EPSILON } from "../core/constants";
import type { ModelFrameBuffer } from "../core/framebuffer";
import { isPlaneBackFacing } from "../geo/utils";
import type { Vector, Vertex } from "../geo/vector";
import { OrthographicCamera, type Camera } from "./camera";
import type { Model } from "./model";

type TopoModel = {
    model: ModelFrameBuffer;
    fronts: Set<TopoModel>;
    backs: Set<TopoModel>;
};

export const topoSort = (
    models: ModelFrameBuffer[],
    camera: Camera
): Map<ModelFrameBuffer, number> => {
    const graph = buildGraph(models, camera);
    const sortedNodes = sortGraph(graph);

    if (sortedNodes.length < graph.length) {
        console.warn("Cycle detected");

        return new Map<ModelFrameBuffer, number>(
            models.sort(compareZ).map((model, i) => [model, i])
        );
    }

    return new Map<ModelFrameBuffer, number>(
        sortedNodes.map((node, i) => [node.model, i])
    );
};

const buildGraph = (models: ModelFrameBuffer[], camera: Camera) => {
    const nodes: TopoModel[] = models.map(model => ({
        model,
        fronts: new Set(),
        backs: new Set(),
    }));

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];

            const side = compare(nodeA.model, nodeB.model, camera);

            // - nodeA is behind nodeB
            if (side < 0) {
                nodeA.fronts.add(nodeB);
                nodeB.backs.add(nodeA);
            }

            // - nodeA is in front of nodeB
            if (side > 0) {
                nodeB.fronts.add(nodeA);
                nodeA.backs.add(nodeB);
            }
        }
    }

    return nodes;
};

const sortGraph = (graph: TopoModel[]) => {
    const sorted: TopoModel[] = [];

    const backmostNodes: TopoModel[] = graph.filter(
        node => node.backs.size === 0
    );

    while (backmostNodes.length > 0) {
        const node = backmostNodes.pop()!;
        sorted.push(node);

        for (const frontNode of node.fronts) {
            frontNode.backs.delete(node);
            if (frontNode.backs.size === 0) {
                backmostNodes.push(frontNode);
            }
        }
    }

    return sorted;
};

const compare = (
    modelA: ModelFrameBuffer,
    modelB: ModelFrameBuffer,
    camera: Camera
): number => {
    if (modelA.EYE == null || modelB.EYE == null) {
        throw new Error("Eye space is not calculated");
    }

    const boundingA = modelA.EYE.geo.bounding;
    const boundingB = modelB.EYE.geo.bounding;

    // Skip separated quadrants
    if (boundingA.maxX <= 0 && boundingB.minX >= 0) {
        return 0;
    }

    if (boundingB.maxX <= 0 && boundingA.minX >= 0) {
        return 0;
    }

    if (boundingA.maxY <= 0 && boundingB.minY >= 0) {
        return 0;
    }

    if (boundingB.maxY <= 0 && boundingA.minY >= 0) {
        return 0;
    }

    // SAT approach
    // Testing is done when any of these are true:
    // - ambiguous split result during the 6 face-normals, return 0
    // - unambiguous split result after the 6 face-normals, return result
    // - split result during the 6 cross-products, return result
    // - all 15 normals tested without split, update CollisionSystem and make split plane by intersection

    let faceNormalResult: number | undefined;

    // Testing the 3 face-normals of OBB A (all six OBB planes as we need unambiguous results)
    for (const plane of boundingA.planes) {
        const isBackFacing = isPlaneBackFacing(
            plane.normal,
            camera.settings.type === "perspective"
                ? boundingA.cuboid[plane.pointIndex].multiply(-1) // // Same as camera(0,0,0).subtract(planePoint.point)
                : OrthographicCamera.directionToCamera
        );

        const result = pointsAndBoundingPlaneCompare(
            { normal: plane.normal, point: boundingA.cuboid[plane.pointIndex] },
            boundingB.cuboid,
            {
                skipBackTest: true,
                invertResult: isBackFacing,
            }
        );

        if (faceNormalResult == null) faceNormalResult = result;
        if (
            result != null &&
            faceNormalResult != null &&
            result * faceNormalResult < 0
        ) {
            return 0;
        }
    }

    // Testing the 3 face-normals of OBB B (all six OBB planes as we need unambiguous results)
    for (const plane of boundingB.planes) {
        const isBackFacing = isPlaneBackFacing(
            plane.normal,
            camera.settings.type === "perspective"
                ? boundingB.cuboid[plane.pointIndex].multiply(-1) // // Same as camera(0,0,0).subtract(planePoint.point)
                : OrthographicCamera.directionToCamera
        );

        const result = pointsAndBoundingPlaneCompare(
            { normal: plane.normal, point: boundingB.cuboid[plane.pointIndex] },
            boundingA.cuboid,
            { skipBackTest: true, invertResult: !isBackFacing }
        );

        if (faceNormalResult == null) faceNormalResult = result;
        if (
            result != null &&
            faceNormalResult != null &&
            result * faceNormalResult < 0
        ) {
            return 0;
        }
    }

    if (faceNormalResult != null) return faceNormalResult;

    // Expensive test below this check, trying to avoid it
    // (boundings equally oriented at this point mean they are colliding)
    if (boundingA.planes[0].normal.equals(boundingB.planes[0].normal)) {
        emitCollision(modelA.model, modelB.model);

        return 0;
    }

    // Testing all cross-products between OBB A planes and OBB B planes
    // (we need the separating plane for sorting, gap vs. no-gap is not enough)
    for (const planeA of boundingA.planes) {
        for (const planeB of boundingB.planes) {
            // Plane normal
            // (also the intersection line direction of planeA and planeB)
            const crossNormal = planeA.normal.cross(planeB.normal);

            // Plane d constants
            const dA = -planeA.normal.dot(boundingA.cuboid[planeA.pointIndex]);
            const dB = -planeB.normal.dot(boundingB.cuboid[planeB.pointIndex]);

            // Calculate separatingPlanePoint
            const crossLengthSq = crossNormal.lengthSq();
            if (crossLengthSq === 0) {
                // Planes are parallel, no unique cross plane
                // Knowing boundings are parallel and not separated by their planes, we know there's a collision.
                // TODO post-mvp: Didn't we already test this at line 183?
                emitCollision(modelA.model, modelB.model);
                return 0; // Boundings are colliding
            }

            const intersectionPoint = planeA.normal
                .multiply(dB)
                .subtract(planeB.normal.multiply(dA));

            const separatingPlanePoint = intersectionPoint
                .cross(crossNormal)
                .divide(crossLengthSq);

            // Plane is ready
            const separatingPlane = {
                normal: crossNormal,
                point: separatingPlanePoint,
            };

            const isBackFacing = isPlaneBackFacing(
                crossNormal,
                camera.settings.type === "perspective"
                    ? separatingPlanePoint.multiply(-1) // // Same as camera(0,0,0).subtract(planePoint.point)
                    : OrthographicCamera.directionToCamera
            );

            const side1 = pointsAndBoundingPlaneCompare(
                separatingPlane,
                boundingB.cuboid,
                {
                    invertResult: isBackFacing,
                }
            );

            if (side1 == null) continue;

            const side2 = pointsAndBoundingPlaneCompare(
                separatingPlane,
                boundingA.cuboid,
                { invertResult: !isBackFacing }
            );

            if (side2 == null) continue;
            if (side1 !== side2) continue;

            return side1;
        }
    }

    emitCollision(modelA.model, modelB.model);

    return 0;
};

const emitCollision = (modelA: Model, modelB: Model) => {
    const collisionId = Math.floor(Math.random() * 10_000);

    modelA.emit("collision", {
        collisionId,
        models: [modelA, modelB],
    });
    modelB.emit("collision", {
        collisionId,
        models: [modelB, modelA],
    });
};

// -1 = plane behind, points in front
const pointsAndBoundingPlaneCompare = (
    plane: {
        normal: Vector;
        point: Vertex;
    },
    points: Vertex[],
    options?: {
        invertResult?: boolean;
        skipBackTest?: boolean;
    }
) => {
    const allDots = points.map(point =>
        point.subtract(plane.point).dot(plane.normal)
    );

    // Points in front of plane
    if (allDots.every(d => d >= -EPSILON)) {
        return options?.invertResult ? 1 : -1;
    }

    if (options?.skipBackTest) return undefined;

    // Points behind plane
    if (allDots.every(d => d <= EPSILON)) {
        return options?.invertResult ? -1 : 1;
    }

    return undefined;
};

// Fallback for cyclic graphs
const compareZ = (
    modelA: ModelFrameBuffer,
    modelB: ModelFrameBuffer
): number => {
    if (modelA.EYE == null || modelB.EYE == null) {
        throw new Error("Eye space is not calculated");
    }

    const boundingA = modelA.EYE.geo.bounding;
    const boundingB = modelB.EYE.geo.bounding;

    const modelDistanceA = boundingA.cuboid
        .reduce((acc, it) => acc.add(it))
        .divide(8)
        .length();

    const modelDistanceB = boundingB.cuboid
        .reduce((acc, it) => acc.add(it))
        .divide(8)
        .length();

    return modelDistanceB - modelDistanceA;
};
