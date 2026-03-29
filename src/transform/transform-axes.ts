import { Matrix } from "../geo/matrix";
import type { Vector } from "../geo/vector";

export abstract class TransformAxes {
    matrix: Matrix = Matrix.identity;
    readonly vector: Vector;

    constructor(
        private readonly onChangeCallback: () => void,
        initValues: Vector
    ) {
        this.vector = initValues.clone();
    }

    get x() {
        return this.vector.x;
    }

    set x(x: number) {
        this.vector.x = x;
        this.onChangeHandlers("x");
    }

    get y() {
        return this.vector.y;
    }

    set y(y: number) {
        this.vector.y = y;
        this.onChangeHandlers("y");
    }

    get z() {
        return this.vector.z;
    }

    set z(z: number) {
        this.vector.z = z;
        this.onChangeHandlers("z");
    }

    set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    toString() {
        return this.vector.toString();
    }

    protected abstract updateMatrix(axis: "x" | "y" | "z"): void;

    private onChangeHandlers(axis: "x" | "y" | "z") {
        this.updateMatrix(axis);
        this.onChangeCallback();
    }
}
