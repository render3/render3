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
        console.warn("Cycle detected. Z-sorting all.");

        /* -  
        const unsorted = graph.filter(node => !sortedNodes.includes(node));
        console.warn(
            `Cycle detected\n${unsorted
                .map(
                    node =>
                        `${node.model.model.id ?? ""} <-- ${
                            [...node.backs][0].model.model.id ?? ""
                        }`
                )
                .join("\n")}`
        );
        */

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

/**
 * Iteration: Sorts a leaf, then updates its front node and makes that a new leaf if it didn't have any other children.
 *            1. Any backmost node can be sorted
 *            2. When a backmost node is sorted, backmostNodes is updated with any new candidate (its front nodes)
 */
const sortGraph = (graph: TopoModel[]) => {
    const sorted: TopoModel[] = [];

    const backmostNodes: TopoModel[] = graph.filter(
        node => node.backs.size === 0
    );

    let hasCycle = false;

    while (backmostNodes.length > 0) {
        const node = backmostNodes.pop()!;
        sorted.push(node);

        for (const frontNode of node.fronts) {
            frontNode.backs.delete(node);
            if (frontNode.backs.size === 0) {
                backmostNodes.push(frontNode);
            }
        }

        // Force-break the cycle (could be done more intelligently though)
        if (backmostNodes.length === 0 && sorted.length < graph.length) {
            hasCycle = true;

            const breakNode = graph.find(
                node => node.backs.size === 1 && !sorted.includes(node)
            );
            if (breakNode) {
                for (const backNode of breakNode.backs) {
                    breakNode.backs.delete(backNode);
                    backNode.fronts.delete(breakNode);
                }

                backmostNodes.push(breakNode);
            }
        }
    }

    if (hasCycle)
        console.warn(
            `Cycle detected. Fixed: ${String(sorted.length === graph.length)}`
        );

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

    /**
     * SAT approach
     *
     * Testing is done when any of these are true:
     * 1. ambiguous split result during the 6 face-normals, return 0
     * 2. unambiguous split result after the 6 face-normals, return result
     * 3. split result during the 6 cross-products, return result
     * 4. all 15 normals tested without split, update CollisionSystem and make split plane by intersection
     *
     * 1.     ___
     *       |___|--> behind
     *           |     ^
     *       _ _ |_ _ _|_
     *           |   |___|
     *   ___     |
     *  _| |_
     * |_____|
     *
     *
     * 3.
     *         /|\     ____
     *       /  |  \ /    / \
     *      |\  |  /|   /     \
     *      |   |   | /         \
     *      |   |   | \         /
     *      |/  |  \|   \     /
     *       \  |  / \____\ /
     *         \|/
     */

    let faceNormalResult: number | undefined;

    // Testing the 3 face-normals of eye-space Oriented Bounding Box (OBB) A (doing all six OBB planes as we need unambiguous sort results, not SAT collision detection only)
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

    // Testing the 3 face-normals of OBB B (doing all six OBB planes as we need unambiguous results, not SAT collision detection only)
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

    // Due to the ambiguous case, we don't know the correct sorting until this point (if there's one)
    if (faceNormalResult != null) return faceNormalResult;

    // Expensive test below this check, trying to avoid it with early collision exit.
    // Boundings equally oriented at this point mean they are overlapping on all three axes and colliding.
    // NB: We don't test the more expensive 90 degree rotation here
    if (
        boundingA.planes[0].normal.equals(boundingB.planes[0].normal) ||
        boundingA.planes[0].normal.equals(
            boundingB.planes[0].normal.multiply(-1)
        )
    ) {
        emitCollision(modelA.model, modelB.model);

        return 0;
    }

    // Testing all cross-products between OBB A planes and OBB B planes
    // (we need the separating plane for sorting, gap vs. no-gap boolean is not enough)
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
                // Planes are parallel (direction not considered), no unique cross plane
                // As already stated and checked for further up, Knowing boundings are parallel and not separated
                // by their planes, we know there's a collision. But this time we check the alignment, not the direction.
                //
                // Due to testing all planes of each bounding, we actually test for equal alignment, not for same
                // direction of the boundings. The side-independent crossLengthSq check enables even quicker exit.

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
