import { Matrix } from "../geo/matrix";
import { TransformAxes } from "./transform-axes";

export class Position<T> extends TransformAxes<T> {
    protected override updateMatrix(axis: "x" | "y" | "z"): void {
        this.matrix = Matrix.translate(this);
    }
}
