import { Matrix } from "../geo/matrix";
import { TransformAxes } from "./transform-axes";

export class Scale extends TransformAxes {
    protected override updateMatrix(axis: "x" | "y" | "z"): void {
        this.matrix = Matrix.scale(this);
    }
}
