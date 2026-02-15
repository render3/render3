import type {
    Frustum,
    OrthographicCameraSettings,
    PerspectiveCameraSettings,
    ViewportDims,
} from "../scene/types";
import type { Vector } from "./vector";
import { Vector3 } from "./vector";

// prettier-ignore
type MatrixTuple = [
	number, number, number,	number,
	number, number, number,	number,
	number, number, number,	number,
	number, number, number,	number
];

export class Matrix {
    // prettier-ignore
    static readonly identity = new Matrix(
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1,
	);

    static frustum(frustum: Frustum) {
        const { left, right, top, bottom, near, far } = frustum;

        return new Matrix(
            (2 * near) / (right - left),
            0,
            (right + left) / (right - left),
            0,

            0,
            (2 * near) / (top - bottom),
            (top + bottom) / (top - bottom),
            0,

            0,
            0,
            -(far + near) / (far - near),
            -(2 * far * near) / (far - near),

            0,
            0,
            -1,
            0
        );
    }

    static perspective(camera: PerspectiveCameraSettings, aspectRatio: number) {
        const { fovY, near, far } = camera;
        const y = Math.tan((fovY * Math.PI) / 360) * near;
        const x = y * aspectRatio;

        return Matrix.frustum({
            top: y,
            bottom: -y,
            right: x,
            left: -x,
            near,
            far,
        });
    }

    static ortho(camera: OrthographicCameraSettings, aspectRatio: number) {
        const { near, far, viewHeight } = camera;
        const viewWidth = viewHeight * aspectRatio;

        const top = viewHeight / 2;
        const bottom = -top;
        const right = viewWidth / 2;
        const left = -right;

        return new Matrix(
            2 / (right - left),
            0,
            0,
            -(right + left) / (right - left),

            0,
            2 / (top - bottom),
            0,
            -(top + bottom) / (top - bottom),

            0,
            0,
            -2 / (far - near),
            -(far + near) / (far - near),

            0,
            0,
            0,
            1
        );
    }

    static viewport(viewport: ViewportDims) {
        const depthRangeMin = 0;
        const depthRangeMax = 1;
        const depthRange = depthRangeMax - depthRangeMin;

        return new Matrix(
            viewport.width / 2, // Scaling
            0,
            0,
            0, // Translation

            0,
            viewport.height / 2, // Scaling
            0,
            0, // Translation

            0,
            0,
            depthRange / 2, // DepthRange scaling to utilize depth buffer.
            depthRangeMin + depthRange / 2, // Translation

            0,
            0,
            0,
            1
        );
    }

    // Flip/mirror axes by negative scaling
    static flip(options: { x?: boolean; y?: boolean; z?: boolean }) {
        const { x, y, z } = options;

        return new Matrix(
            x ? -1 : 1,
            0,
            0,
            0,

            0,
            y ? -1 : 1,
            0,
            0,

            0,
            0,
            z ? -1 : 1,
            0,

            0,
            0,
            0,
            1
        );
    }

    static translate(options: Partial<Vector>) {
        const { x = 0, y = 0, z = 0 } = options;

        // prettier-ignore
        return new Matrix(
            1, 0, 0, x,
            0, 1, 0, y,
            0, 0, 1, z,
            0, 0, 0, 1,
        );
    }

    static rotate(options: {
        angle: number;
        x?: number;
        y?: number;
        z?: number;
    }) {
        const unitVector = new Vector3(
            options.x ?? 0,
            options.y ?? 0,
            options.z ?? 0
        ).unit();
        const { angle } = options;
        const { x, y, z } = unitVector;

        const r = angle / (180 / Math.PI); // Radians

        const q0 = Math.cos(r / 2);
        const q1 = Math.sin(r / 2) * x;
        const q2 = Math.sin(r / 2) * y;
        const q3 = Math.sin(r / 2) * z;

        return new Matrix(
            q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3,
            2 * (q1 * q2 - q0 * q3),
            2 * (q1 * q3 + q0 * q2),
            0,

            2 * (q2 * q1 + q0 * q3),
            q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3,
            2 * (q2 * q3 - q0 * q1),
            0,

            2 * (q3 * q1 - q0 * q2),
            2 * (q3 * q2 + q0 * q1),
            q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3,
            0,

            0,
            0,
            0,
            1
        );
    }

    static scale(options: Partial<Vector>) {
        const { x = 1, y = 1, z = 1 } = options;

        // prettier-ignore
        return new Matrix(
            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1,
        );
    }

    // View matrix
    static lookAt(
        eyeVector: Vector,
        centerVector: Vector,
        upVector = new Vector3(0, 1, 0)
    ) {
        const forward = eyeVector.subtract(centerVector).unit();
        const side = upVector.cross(forward).unit();
        const up = forward.cross(side).unit();

        return new Matrix(
            side.x,
            side.y,
            side.z,
            -side.dot(eyeVector),

            up.x,
            up.y,
            up.z,
            -up.dot(eyeVector),

            forward.x,
            forward.y,
            forward.z,
            -forward.dot(eyeVector),

            0,
            0,
            0,
            1
        );
    }

    // Create rotation matrix (transpose of lookAt rotation for world-to-camera)
    // This works for both cameras and regular models
    static lookAtInWorld(
        eyeVector: Vector,
        centerVector: Vector,
        upVector = new Vector3(0, 1, 0)
    ) {
        const forward = eyeVector.subtract(centerVector).unit();
        const side = upVector.cross(forward).unit();
        const up = forward.cross(side).unit();

        return new Matrix(
            side.x,
            up.x,
            forward.x,
            0,

            side.y,
            up.y,
            forward.y,
            0,

            side.z,
            up.z,
            forward.z,
            0,

            0,
            0,
            0,
            1
        );
    }

    readonly elements: MatrixTuple;

    constructor(...numbers: MatrixTuple) {
        this.elements = numbers;
    }

    equals(matrix: Matrix) {
        return matrix.elements.every((n, i) => n === this.elements[i]);
    }

    isIdentity(): boolean {
        return this.equals(Matrix.identity);
    }

    multiply(matrix: Matrix) {
        const a = this.elements;
        const b = matrix.elements;

        return new Matrix(
            a[0] * b[0] + a[1] * b[4] + a[2] * b[8] + a[3] * b[12],
            a[0] * b[1] + a[1] * b[5] + a[2] * b[9] + a[3] * b[13],
            a[0] * b[2] + a[1] * b[6] + a[2] * b[10] + a[3] * b[14],
            a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3] * b[15],

            a[4] * b[0] + a[5] * b[4] + a[6] * b[8] + a[7] * b[12],
            a[4] * b[1] + a[5] * b[5] + a[6] * b[9] + a[7] * b[13],
            a[4] * b[2] + a[5] * b[6] + a[6] * b[10] + a[7] * b[14],
            a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7] * b[15],

            a[8] * b[0] + a[9] * b[4] + a[10] * b[8] + a[11] * b[12],
            a[8] * b[1] + a[9] * b[5] + a[10] * b[9] + a[11] * b[13],
            a[8] * b[2] + a[9] * b[6] + a[10] * b[10] + a[11] * b[14],
            a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11] * b[15],

            a[12] * b[0] + a[13] * b[4] + a[14] * b[8] + a[15] * b[12],
            a[12] * b[1] + a[13] * b[5] + a[14] * b[9] + a[15] * b[13],
            a[12] * b[2] + a[13] * b[6] + a[14] * b[10] + a[15] * b[14],
            a[12] * b[3] + a[13] * b[7] + a[14] * b[11] + a[15] * b[15]
        );
    }

    transpose() {
        const m = this.elements;

        return new Matrix(
            m[0],
            m[4],
            m[8],
            m[12],

            m[1],
            m[5],
            m[9],
            m[13],

            m[2],
            m[6],
            m[10],
            m[14],

            m[3],
            m[7],
            m[11],
            m[15]
        );
    }

    inverse() {
        const m = this.elements;

        const r = new Matrix(
            m[5] * m[10] * m[15] -
                m[5] * m[14] * m[11] -
                m[6] * m[9] * m[15] +
                m[6] * m[13] * m[11] +
                m[7] * m[9] * m[14] -
                m[7] * m[13] * m[10],
            -m[1] * m[10] * m[15] +
                m[1] * m[14] * m[11] +
                m[2] * m[9] * m[15] -
                m[2] * m[13] * m[11] -
                m[3] * m[9] * m[14] +
                m[3] * m[13] * m[10],
            m[1] * m[6] * m[15] -
                m[1] * m[14] * m[7] -
                m[2] * m[5] * m[15] +
                m[2] * m[13] * m[7] +
                m[3] * m[5] * m[14] -
                m[3] * m[13] * m[6],
            -m[1] * m[6] * m[11] +
                m[1] * m[10] * m[7] +
                m[2] * m[5] * m[11] -
                m[2] * m[9] * m[7] -
                m[3] * m[5] * m[10] +
                m[3] * m[9] * m[6],

            -m[4] * m[10] * m[15] +
                m[4] * m[14] * m[11] +
                m[6] * m[8] * m[15] -
                m[6] * m[12] * m[11] -
                m[7] * m[8] * m[14] +
                m[7] * m[12] * m[10],
            m[0] * m[10] * m[15] -
                m[0] * m[14] * m[11] -
                m[2] * m[8] * m[15] +
                m[2] * m[12] * m[11] +
                m[3] * m[8] * m[14] -
                m[3] * m[12] * m[10],
            -m[0] * m[6] * m[15] +
                m[0] * m[14] * m[7] +
                m[2] * m[4] * m[15] -
                m[2] * m[12] * m[7] -
                m[3] * m[4] * m[14] +
                m[3] * m[12] * m[6],
            m[0] * m[6] * m[11] -
                m[0] * m[10] * m[7] -
                m[2] * m[4] * m[11] +
                m[2] * m[8] * m[7] +
                m[3] * m[4] * m[10] -
                m[3] * m[8] * m[6],

            m[4] * m[9] * m[15] -
                m[4] * m[13] * m[11] -
                m[5] * m[8] * m[15] +
                m[5] * m[12] * m[11] +
                m[7] * m[8] * m[13] -
                m[7] * m[12] * m[9],
            -m[0] * m[9] * m[15] +
                m[0] * m[13] * m[11] +
                m[1] * m[8] * m[15] -
                m[1] * m[12] * m[11] -
                m[3] * m[8] * m[13] +
                m[3] * m[12] * m[9],
            m[0] * m[5] * m[15] -
                m[0] * m[13] * m[7] -
                m[1] * m[4] * m[15] +
                m[1] * m[12] * m[7] +
                m[3] * m[4] * m[13] -
                m[3] * m[12] * m[5],
            -m[0] * m[5] * m[11] +
                m[0] * m[9] * m[7] +
                m[1] * m[4] * m[11] -
                m[1] * m[8] * m[7] -
                m[3] * m[4] * m[9] +
                m[3] * m[8] * m[5],

            -m[4] * m[9] * m[14] +
                m[4] * m[13] * m[10] +
                m[5] * m[8] * m[14] -
                m[5] * m[12] * m[10] -
                m[6] * m[8] * m[13] +
                m[6] * m[12] * m[9],
            m[0] * m[9] * m[14] -
                m[0] * m[13] * m[10] -
                m[1] * m[8] * m[14] +
                m[1] * m[12] * m[10] +
                m[2] * m[8] * m[13] -
                m[2] * m[12] * m[9],
            -m[0] * m[5] * m[14] +
                m[0] * m[13] * m[6] +
                m[1] * m[4] * m[14] -
                m[1] * m[12] * m[6] -
                m[2] * m[4] * m[13] +
                m[2] * m[12] * m[5],
            m[0] * m[5] * m[10] -
                m[0] * m[9] * m[6] -
                m[1] * m[4] * m[10] +
                m[1] * m[8] * m[6] +
                m[2] * m[4] * m[9] -
                m[2] * m[8] * m[5]
        );

        const det =
            m[0] * r.elements[0] +
            m[1] * r.elements[4] +
            m[2] * r.elements[8] +
            m[3] * r.elements[12];

        if (det === 0) {
            console.warn(
                "Matrix is singular and does not have an inverse",
                this.toString()
            );
            return this;
        }

        for (let entry of r.elements) {
            entry = entry / det; // eslint-disable-line operator-assignment
        }

        return r;
    }

    toString() {
        const m = this.elements;
        return `${m[0]}, ${m[1]}, ${m[2]}, ${m[3]},\n${m[4]}, ${m[5]}, ${m[6]}, ${m[7]},\n${m[8]}, ${m[9]}, ${m[10]}, ${m[11]},\n${m[12]}, ${m[13]}, ${m[14]}, ${m[15]}`;
    }
}
