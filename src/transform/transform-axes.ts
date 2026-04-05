import { Matrix } from "../geo/matrix";
import type { Vector, XYZ } from "../geo/vector";
import { typeGuardByProperty } from "../utils/typechecks";

export abstract class TransformAxes<T> {
    matrix: Matrix = Matrix.identity;
    readonly vector: Vector;

    constructor(
        private readonly object3D: T,
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

    set(vector: XYZ): void;
    set(x: number, y: number, z: number): void;
    set(vector: XYZ | number, y?: number, z?: number) {
        this.x = typeGuardByProperty<XYZ>(vector, "x") ? vector.x : vector;
        this.y = typeGuardByProperty<XYZ>(vector, "y") ? vector.y : y ?? 0;
        this.z = typeGuardByProperty<XYZ>(vector, "z") ? vector.z : z ?? 0;
        return this.object3D;
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
