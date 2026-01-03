/* eslint-disable @typescript-eslint/unified-signatures */
import type { Camera } from "./camera";
import type { AmbientLightOptions, DirectionalLightOptions } from "./light";
import { AmbientLight, DirectionalLight } from "./light";
import type { Group } from "./model";
import { Model } from "./model";
import { SceneNode } from "./scene-node";

type Options = {
    models?: Model[];
    background?: string;
    ambientLight?: AmbientLightOptions;
    directionalLight?: DirectionalLightOptions;
};

export class Scene extends SceneNode<Scene, never, Model | Group | Camera> {
    background?: string;
    ambientLight: AmbientLight = new AmbientLight();
    directionalLight: DirectionalLight = new DirectionalLight();

    // TODO mvp: wrong, should support group and camera too
    constructor();
    constructor(options?: Options);
    constructor(...models: Model[]);
    constructor(parameter?: Options | Model, ...parameterN: Model[]) {
        super();

        if (parameter instanceof Model) {
            super.add(parameter);
            super.add(...parameterN);
        } else {
            super.add(...(parameter?.models ?? []));
            this.background = parameter?.background;
            Object.assign(this.ambientLight, parameter?.ambientLight);
            Object.assign(this.directionalLight, parameter?.directionalLight);
        }
    }
}
