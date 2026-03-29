import { Matrix } from "../geo/matrix";
import { TransformAxes } from "./transform-axes";

export class Rotation extends TransformAxes {
    private xMatrix: Matrix = Matrix.identity;
    private yMatrix: Matrix = Matrix.identity;
    private zMatrix: Matrix = Matrix.identity;

    protected override updateMatrix(axis: "x" | "y" | "z"): void {
        switch (axis) {
            case "x": {
                this.xMatrix = Matrix.rotate({ angle: super[axis], [axis]: 1 });
                break;
            }

            case "y": {
                this.yMatrix = Matrix.rotate({ angle: super[axis], [axis]: 1 });
                break;
            }

            case "z": {
                this.zMatrix = Matrix.rotate({ angle: super[axis], [axis]: 1 });
                break;
            }
            // No default
        }

        this.matrix = Matrix.identity
            .multiply(this.xMatrix)
            .multiply(this.yMatrix)
            .multiply(this.zMatrix);
    }
}
