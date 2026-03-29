import { Matrix } from "../geo/matrix";
import { TransformAxes } from "./transform-axes";

export class Position extends TransformAxes {
    protected override updateMatrix(axis: "x" | "y" | "z"): void {
        this.matrix = Matrix.translate(this);
    }
}
