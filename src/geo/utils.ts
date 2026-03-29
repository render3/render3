import type { Vector } from "./vector";
import { Vector4, Vector3 } from "./vector";

// For arbitrary polygons it's hard to pick three points making a precise plane.
// Newell's Method lets us use all points.
export const newellNormal = (vectors: Vector[]): Vector3 | undefined => {
    const normal = new Vector3(0, 0, 0);
    for (let i = 0, ilength = vectors.length; i < ilength; i += 1) {
        const iNext = (i + 1) % ilength;
        normal.x +=
            (vectors[i].y - vectors[iNext].y) *
            (vectors[i].z + vectors[iNext].z);
        normal.y +=
            (vectors[i].z - vectors[iNext].z) *
            (vectors[i].x + vectors[iNext].x);
        normal.z +=
            (vectors[i].x - vectors[iNext].x) *
            (vectors[i].y + vectors[iNext].y);
    }

    if (normal.length() === 0) return undefined;

    return normal.unit();
};

/**
 * Linear interpolation between two points
 *
 * @param alpha - number between 0 and 1 to tell where we want to find the new point on the
 *                straight line (0=pointA, 1=pointB)
 */
export const lerp = (
    vectorA: Vector,
    vectorB: Vector,
    alpha: number
): Vector => {
    if (alpha < 0 || alpha > 1) {
        console.error("Invalid alpha");
    }

    if (alpha === 0) {
        return vectorA;
    }

    if (alpha === 1) {
        return vectorB;
    }

    return new Vector4(
        (1 - alpha) * vectorA.x + alpha * vectorB.x,
        (1 - alpha) * vectorA.y + alpha * vectorB.y,
        (1 - alpha) * vectorA.z + alpha * vectorB.z,
        (1 - alpha) * vectorA.w + alpha * vectorB.w
    );
};

export class Plane {
    readonly origo: Vector3; // TODO mvp: change name to "position"?
    readonly unitNormal: Vector;
    readonly d: number; // <0 = front-facing

    constructor(
        definition:
            | {
                  origo: Vector3;
                  normal: Vector;
              }
            | {
                  origo: Vector3;
                  points: [Vector3, Vector3];
              }
    ) {
        this.origo = definition.origo;
        this.unitNormal =
            "normal" in definition
                ? definition.normal.unit()
                : definition.points[0]
                      .subtract(definition.origo)
                      .cross(definition.points[1].subtract(definition.origo))
                      .unit();

        this.d = this.unitNormal.dot(definition.origo);
    }
}

export const isPlaneBackFacing = (
    planeNormal: Vector,
    directionToCamera: Vector3
) => planeNormal.dot(directionToCamera) <= 0; // == angle>90

/**
 * Finding winding order using Shoelace formula in a Cartesian coordinate system (positive y upwards)
 */
export const windingOrder2D = (vectors: Vector3[]) => {
    let sum = 0;
    for (let i = 0, ilength = vectors.length; i < ilength; i += 1) {
        sum +=
            (vectors[(i + 1) % ilength].x - vectors[i].x) *
            (vectors[(i + 1) % ilength].y + vectors[i].y);
    }

    if (sum < 0) return "CCW";
    if (sum > 0) return "CW";
    return "unknown";
};
