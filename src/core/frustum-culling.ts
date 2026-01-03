import type { Vector } from "../geo/vector";

export const FRUSTUM_NEAR = 0;
export const FRUSTUM_FAR = 1;
export const FRUSTUM_LEFT = 2;
export const FRUSTUM_RIGHT = 3;
export const FRUSTUM_TOP = 4;
export const FRUSTUM_BOTTOM = 5;

export type FRUSTUM_PLANE =
    | typeof FRUSTUM_NEAR
    | typeof FRUSTUM_FAR
    | typeof FRUSTUM_LEFT
    | typeof FRUSTUM_RIGHT
    | typeof FRUSTUM_TOP
    | typeof FRUSTUM_BOTTOM;

/**
 * @see https://chaosinmotion.blog/2016/05/22/3d-clipping-in-homogeneous-coordinates/
 */
const dot = (vector: Vector, plane: FRUSTUM_PLANE) => {
    switch (plane) {
        case FRUSTUM_LEFT: {
            return vector.x + vector.w;
        }

        case FRUSTUM_RIGHT: {
            return -vector.x + vector.w;
        }

        case FRUSTUM_TOP: {
            return vector.y + vector.w;
        }

        case FRUSTUM_BOTTOM: {
            return -vector.y + vector.w;
        }

        case FRUSTUM_NEAR: {
            return vector.z + vector.w;
        }

        case FRUSTUM_FAR: {
            return -vector.z + vector.w;
        }
        // No default
    }
};

export const vectorPlanePosition = (
    vector: Vector,
    plane: FRUSTUM_PLANE
): {
    dotProduct: number;
    position: "INSIDE" | "PLANE" | "OUTSIDE";
} => {
    const dotProduct = dot(vector, plane);

    if (dotProduct > 0) {
        return {
            dotProduct,
            position: "INSIDE",
        };
    }

    if (dotProduct < 0) {
        return {
            dotProduct,
            position: "OUTSIDE",
        };
    }

    return {
        dotProduct,
        position: "PLANE",
    };
};
