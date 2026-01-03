import { EPSILON } from "../core/constants";
import { isNotNull } from "../utils/ts-util";
import type { Matrix } from "./matrix";

export const W = {
    position: 1,
    direction: 0,
};

export abstract class Vector {
    constructor(
        public x: number,
        public y: number,
        public z: number,
        public readonly w = W.position
    ) {
        if (Number.isNaN(x)) console.warn("x is NaN");
        if (Number.isNaN(y)) console.warn("y is NaN");
        if (Number.isNaN(z)) console.warn("z is NaN");
    }

    set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;

        if (Number.isNaN(x)) console.warn("x is NaN");
        if (Number.isNaN(y)) console.warn("y is NaN");
        if (Number.isNaN(z)) console.warn("z is NaN");
    }

    asVertex() {
        return new Vertex(this.x, this.y, this.z);
    }

    equals(vector: Vector): boolean {
        return (
            Math.abs(vector.x - this.x) < EPSILON &&
            Math.abs(vector.y - this.y) < EPSILON &&
            Math.abs(vector.z - this.z) < EPSILON &&
            Math.abs(vector.w - this.w) < EPSILON
        );
    }

    clone(): Vector {
        return new Vector4(this.x, this.y, this.z, this.w);
    }

    transform(matrix: Matrix): Vector4 {
        if (matrix.isIdentity()) return this;

        const m = matrix.elements;

        const x = m[0] * this.x + m[1] * this.y + m[2] * this.z + m[3] * this.w;
        const y = m[4] * this.x + m[5] * this.y + m[6] * this.z + m[7] * this.w;
        const z =
            m[8] * this.x + m[9] * this.y + m[10] * this.z + m[11] * this.w;
        const w =
            m[12] * this.x + m[13] * this.y + m[14] * this.z + m[15] * this.w;

        return new Vector4(x, y, z, w);
    }

    /**
     * Dot is > 0 if angle between two vectors is < 90deg. Shortest angle is considered, no axes are
     * considered. Could be used in 2D with z=0.
     * - Two parallel planes are facing same way if dot > 0
     * - In case of a plane normal and a point, the point is on same side of the plane as its normal if
     *   dot > 0 (as a plane normal is 90deg to its plane). If plane is not going through origin, the
     *   point has to be adjusted first by doing point.subtract(planePoint) to get the point in correct
     *   place imagining planePoint is moved to origin.
     *
     * @param {Vector} vector - vector or point, order not important
     * @returns {number} - the dot/scalar product
     */
    dot(vector: Vector) {
        return this.x * vector.x + this.y * vector.y + this.z * vector.z;
    }

    /**
     * @returns {Vector} - vector that is perpendicular (orthogonal) to both this and vector with
     *                     magnitude equals the area of a parallelogram formed by this and vector
     */
    cross(vector: Vector) {
        return new Vector3(
            this.y * vector.z - this.z * vector.y,
            this.z * vector.x - this.x * vector.z,
            this.x * vector.y - this.y * vector.x
        );
    }

    lengthSq() {
        return this.dot(this);
    }

    length() {
        return Math.sqrt(this.lengthSq());
    }

    normalizeW() {
        if (this.w === 0) {
            console.error("w component is zero.");
        }

        return new Vector4(
            this.x / this.w,
            this.y / this.w,
            this.z / this.w,
            W.position
        );
    }

    unit() {
        return this.divide(this.length());
    }

    multiply(multiplier: number) {
        return new Vector3(
            this.x * multiplier,
            this.y * multiplier,
            this.z * multiplier
        );
    }

    divide(divisor: number) {
        if (divisor === 0) console.warn("divisor is 0");

        return new Vector3(
            this.x / divisor,
            this.y / divisor,
            this.z / divisor
        );
    }

    add(vector: Vector) {
        return new Vector3(
            this.x + vector.x,
            this.y + vector.y,
            this.z + vector.z
        );
    }

    subtract(vector: Vector) {
        return new Vector3(
            this.x - vector.x,
            this.y - vector.y,
            this.z - vector.z
        );
    }

    flipY() {
        return new Vector3(this.x, -this.y, this.z);
    }

    flipZ() {
        return new Vector3(this.x, this.y, -this.z);
    }

    toString() {
        return `${this.x} ${this.y} ${this.z}`;
    }
}

export class Vector3 extends Vector {
    static readonly origin = new Vector3(0, 0, 0);

    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(x: number, y: number, z: number) {
        super(x, y, z);
    }
}

export class Vector4 extends Vector {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(x: number, y: number, z: number, w: number) {
        super(x, y, z, w);
    }
}

export class Vertex extends Vector3 {
    static from(numbers: number[], dimensions: 2 | 3): Vertex[] {
        return numbers
            .map((number, index) => {
                if (dimensions === 2 && index > 0 && index % 2 === 1) {
                    return new Vertex(numbers[index - 1], number);
                }

                if (dimensions === 3 && index > 0 && index % 3 === 2) {
                    return new Vertex(
                        numbers[index - 2],
                        numbers[index - 1],
                        number
                    );
                }

                return undefined;
            })
            .filter(isNotNull);
    }

    constructor(
        public readonly x: number,
        public readonly y: number,
        public readonly z = 0
    ) {
        super(x, y, z);
    }

    override equals(vertex: Vertex): boolean {
        return (
            vertex.x === this.x && vertex.y === this.y && vertex.z === this.z
        );
    }

    override clone(): Vertex {
        return new Vertex(this.x, this.y, this.z);
    }
}
