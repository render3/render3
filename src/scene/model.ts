/* eslint-disable @typescript-eslint/unified-signatures */

import { Matrix } from "../geo/matrix";
import type { Vector } from "../geo/vector";
import { Vector3 } from "../geo/vector";
import { Position } from "../transform/position";
import { Rotation } from "../transform/rotation";
import { Scale } from "../transform/scale";
import { isNotNull } from "../utils/ts-util";
import { typeGuardByProperty } from "../utils/typechecks";
import { createObservableArray } from "../utils/utils";
import { BSP } from "./bsp";
import type { Camera } from "./camera";
import type { Scene } from "./scene";
import { SceneNode } from "./scene-node";
import type { ShapeWithNormal, Material, Shape } from "./shape";

type Options = {
    id?: string; // TODO mvp: is this forwarded to dom?
    shapes?: Shape[];
    material?: Material;
};

export abstract class Object3D<
    T extends Model | Group | Camera
> extends SceneNode<T, Scene | Model | Group | Camera, Model | Group | Camera> {
    // From local space to world space
    modelMatrix: Matrix = Matrix.identity;

    // Local/World space
    readonly scale: Scale = new Scale(() => {
        this.updateModelMatrix();
    }, new Vector3(1, 1, 1));

    // Local/World space
    readonly rotation: Rotation = new Rotation(() => {
        this.updateModelMatrix();
    }, new Vector3(0, 0, 0));

    // Local/World space
    readonly position: Position = new Position(() => {
        this.updateModelMatrix();
    }, new Vector3(0, 0, 0));

    abstract _bsp: BSP | undefined;

    lookAt(lookAt: Partial<Vector>): void;
    lookAt(x: number, y: number, z: number): void;
    lookAt(lookAt: Partial<Vector> | number, y?: number, z?: number) {
        const lookAtVector = new Vector3(
            typeGuardByProperty<Partial<Vector>>(lookAt, "x")
                ? lookAt.x ?? 0
                : lookAt,
            typeGuardByProperty<Partial<Vector>>(lookAt, "y")
                ? lookAt.y ?? 0
                : y ?? 0,
            typeGuardByProperty<Partial<Vector>>(lookAt, "z")
                ? lookAt.z ?? 0
                : z ?? 0
        );

        // Create rotation matrix (transpose of lookAt rotation for world-to-camera)
        this.rotation.matrix = Matrix.lookAtInWorld(
            this.position.vector,
            lookAtVector
        );
        this.updateModelMatrix();
    }

    private updateModelMatrix() {
        // 3) translating in local space
        this.modelMatrix = this.position.matrix
            // 2) rotating in local space
            .multiply(this.rotation.matrix)
            // 1) scaling in local space
            .multiply(this.scale.matrix);
    }
}

// Models update their local/world matrix themselves (modelMatrix). This means that transforms happen in all scenes which is intentionally.
export class Model extends Object3D<Model> {
    material?: Material;
    _bsp: BSP = new BSP();
    // Making it readonly as a reassignment would remove the proxy
    // TODO post-mvp?: Make it consistent with setters in Shape instead?
    readonly shapes: Shape[] = createObservableArray(shapes => {
        const validShapes = shapes.filter((shape): shape is ShapeWithNormal => {
            if (shape._normal == null)
                console.warn(`Shape ${shape.id} is invalid`);
            return shape._normal != null;
        });
        this._bsp = new BSP(validShapes);
    });

    private readonly _clonableOptions: Options;

    constructor();
    constructor(options?: Options);
    constructor(...shapes: Shape[]);
    constructor(parameter?: Options | Shape, ...parameterN: Shape[]) {
        super(
            typeGuardByProperty<Options>(parameter, "shapes")
                ? parameter?.id
                : undefined
        );
        this._clonableOptions = {
            ...(typeGuardByProperty<Options>(parameter, "shapes")
                ? parameter
                : { shapes: [parameter, ...parameterN].filter(isNotNull) }),
        };

        if (typeGuardByProperty<Options>(parameter, "shapes")) {
            this.shapes.push(...(parameter?.shapes ?? []));
            this.material = parameter?.material;
        } else if (parameter != null) {
            this.shapes.push(parameter, ...parameterN);
        }
    }

    clone(options?: Options) {
        return new Model({
            ...this._clonableOptions,
            material: this.material,
            ...options,
        });
    }

    // TODO post-mvp: methods

    /* -
    private transform(matrix: Matrix) {
        for (const shape of this.shapes) {
            shape.transform(matrix);
        }
    }
    */
    /*
    // Rotates the model around x axis in local space. Might affect pivot point.
    rotateX(degrees: number): this {
        console.log(degrees);
        return this;
    }

    // Rotates the model around y axis in local space. Might affect pivot point.
    rotateY(degrees: number): this {
        console.log(degrees);
        return this;
    }

    // Rotates the model around z axis in local space. Might affect pivot point.
    rotateZ(degrees: number): this {
        console.log(degrees);
        return this;
    }

    // Rotates the model with Euler angles in local space. Might affect pivot point.
    rotate(x: number, y: number, z: number): this {
        console.log(x, y, z);
        return this;
    }

    // Rotates the model around arbitrary axis in local space. Might affect pivot point.
    rotateOnAxis(axis: Vertex, degrees: number): this {
        console.log(axis, degrees);
        return this;
    }

    // Scales the model in local space.
    scale(factor: Vertex | number): this {
        console.log(factor);
        return this;
    }

    // Rotates the model with Euler angles in world space (scene).
    rotateInWorld(x: number, y: number, z: number): this {
        console.log(x, y, z);
        return this;
    }

    // Rotates the model around arbitrary axis in world space (scene).
    rotateOnAxisInWorld(axis: Vertex, degrees: number): this {
        console.log(axis, degrees);
        return this;
    }

    // Scales the model in world space (scene).
    scaleInWorld(factor: Vertex | number): this {
        console.log(factor);
        return this;
    }

    // Translates the model along x axis in world space (scene).
    translateXInWorld(distance: number): this {
        console.log(distance);
        return this;
    }

    // Translates the model along y axis in world space (scene).
    translateYInWorld(distance: number): this {
        console.log(distance);
        return this;
    }

    // Translates the model along z axis in world space (scene).
    translateZInWorld(distance: number): this {
        console.log(distance);
        return this;
    }

    // Translates the model in world space (scene).
    translateInWorld(x: number, y: number, z: number): this {
        console.log(x, y, z);
        return this;
    }

    // Translates the model in world space (scene).
    translateOnAxisInWorld(axis: Vertex, distance: number): this {
        console.log(axis, distance);
        return this;
    }
*/
}

/**
 * Grouping is all about convenience and structure. It enables
 * - splitting concave models into convex parts to make tighter boundings
 * - less repetition
 * - flat hierarchy without dependencies between the models (but dependent on parent level)
 * - semantic and loose coupled hierarchy with separation of concern:
 *      carGroup
 *      |- body
 *      |- wheelGroup
 *          |- wheel
 *          |- ...
 *      |- tireSmokeEffect
 *          |- smokeModel
 *          |- ...
 *   instead of carBodyModel -> carWheelModel -> carSmoke  (1. Wheels should not be part of the body. 2. Harder to update and replace models.)
 * -
 */
export class Group extends Object3D<Group> {
    // TODO post-mvp: handle bsp explicit for Models instead of letting them be undefined in Group where they don't make sense
    _bsp = undefined;
    material = undefined;
}
