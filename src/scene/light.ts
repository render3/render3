import type { Vector } from "../geo/vector";
import { Vector3 } from "../geo/vector";
import type { uint8 } from "../utils/color";
import { RGBColor } from "../utils/color";

export type LightOptions = {
    switch?: "ON" | "OFF";
    intensity?: number;
};

const DEFAULT_INTENSITY = 0.5;

export abstract class Light {
    value: RGBColor;

    private _switch: "ON" | "OFF" = "ON";
    private _intensity = DEFAULT_INTENSITY;
    private readonly color = new RGBColor([255, 255, 255]); // Only supporting white light for now as color spaces are complex to get correct and heavy to calculate

    constructor(options?: LightOptions) {
        this.value = new RGBColor([
            Math.round(this.color.values[0]) as uint8,
            Math.round(this.color.values[1]) as uint8,
            Math.round(this.color.values[2]) as uint8,
        ]);
        this.intensity = options?.intensity ?? DEFAULT_INTENSITY;
        this.switch = options?.switch ?? "ON";
    }

    get intensity() {
        return this._intensity;
    }

    set intensity(intensity: number) {
        this._intensity = intensity;
        if (this.switch === "OFF") return;

        this.value = new RGBColor([
            Math.round(this.color.values[0] * this.intensity) as uint8,
            Math.round(this.color.values[1] * this.intensity) as uint8,
            Math.round(this.color.values[2] * this.intensity) as uint8,
        ]);
    }

    get switch() {
        return this._switch;
    }

    set switch(value: "ON" | "OFF") {
        this._switch = value;
        if (value === "ON") return;

        this.value = new RGBColor([0, 0, 0]);
    }
}

export type AmbientLightOptions = LightOptions & Record<string, unknown>;

export class AmbientLight extends Light {
    constructor();
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(options?: AmbientLightOptions) {
        super(options);
    }
}

// TODO post-mvp: support Diffuse lighting?

export type DirectionalLightOptions = LightOptions & {
    x?: number;
    y?: number;
    z?: number;
};

export class DirectionalLight extends Light {
    direction: Vector;

    constructor();
    constructor(options?: DirectionalLightOptions) {
        super(options);

        // Direction of incoming light toward a surface (not the lightray direction)
        const { x = 0.5, y = 1, z = 0.5 } = options ?? {};
        this.direction = new Vector3(x, y, z).unit();
    }
}
