import { newellNormal } from "../geo/utils";
import type { Vector } from "../geo/vector";
import type { AmbientLight, DirectionalLight } from "../scene/light";
import type { Material, Shape } from "../scene/shape";
import type { uint8 } from "../utils/color";
import { getComputedColor, RGBColor } from "../utils/color";

export const shapeNormal = (shape: Shape) => {
    return newellNormal(shape.points);
};

export const shape_light = (
    modelNormal: Vector,
    ambientLight: AmbientLight,
    directionalLight: DirectionalLight
): RGBColor => {
    const lightReflected = Math.max(
        0,
        modelNormal.dot(directionalLight.direction)
    );

    const shapeDirectionalLight = new RGBColor([
        (directionalLight.value.values[0] * lightReflected) as uint8,
        (directionalLight.value.values[0] * lightReflected) as uint8,
        (directionalLight.value.values[0] * lightReflected) as uint8,
    ]);

    return ambientLight.value.blendAdditive(shapeDirectionalLight);
};

export const shape_color = (
    material: Material,
    light: RGBColor = new RGBColor([0, 0, 0])
): string | undefined => {
    const computedColor = getComputedColor(material.color)
        ?.blendMultiply(light)
        .values.join(",");

    if (computedColor) {
        return `rgb(${computedColor})`;
    }

    return undefined;
};
