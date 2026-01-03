import { shape_color, shape_light } from "../core/default-impl";
import type { Scene } from "../scene/scene";
import type { FrameBuffer } from "../core/framebuffer";
import type { DomNamespace } from "../types/dom";
import { isNotNull } from "../utils/ts-util";
import { defaultViewport } from "../scene/camera";
import type { DomNodeDefinition } from "./pipeline-types";
import { SVGContainer } from "./svg-container";
import type { RendererInputOptions } from "./renderer";

export class SVGDOMRenderer extends SVGContainer {
    constructor(options?: Partial<RendererInputOptions>) {
        super(options?.domElement, {
            viewport: options?.viewport ?? defaultViewport,
            vsd: {
                culling: {
                    backface: options?.backfaceCulling ?? false,
                },
            },
        });
    }

    override toDom(
        scene: Scene,
        frameBuffer: FrameBuffer
    ): Array<DomNodeDefinition<DomNamespace.SVG>> {
        if (scene.background) {
            this.domElement.style.backgroundColor = scene.background;
        }

        return (
            frameBuffer
                .models()
                .map(m => m.SCREEN) // Get models with screen data
                .filter(isNotNull)
                .flatMap(modelBuffer => {
                    const { geo, modelFrameBuffer } = modelBuffer;
                    const { vertices, shapes } = geo;

                    return shapes
                        .filter(shapeGeo => shapeGeo.vertexIndices.length) // Clipping might remove all points on a shape
                        .map(shapeGeo => {
                            const material =
                                shapeGeo.shape.material ??
                                modelFrameBuffer.model.material ??
                                {};

                            const usePath = shapeGeo.shape._holePoints.length;

                            return {
                                elementDescriptor: {
                                    tag: usePath ? "path" : "polygon",
                                },
                                elementWrappers: [],
                                fillElement(element) {
                                    element.setAttribute(
                                        "id",
                                        shapeGeo.shape.id
                                    );

                                    if (usePath) {
                                        element.setAttribute(
                                            "fill-rule",
                                            "evenodd"
                                        );

                                        element.setAttribute(
                                            "d",
                                            shapeGeo.vertexIndices
                                                .map(i => vertices.array[i])
                                                .map(
                                                    (point, i) =>
                                                        `${
                                                            i === 0
                                                                ? "M "
                                                                : "L "
                                                        }${point.x} ${-point.y}`
                                                )
                                                .join(" ") +
                                                " Z" +
                                                shapeGeo.holeVertexIndices
                                                    .map(
                                                        hole =>
                                                            hole
                                                                .map(
                                                                    i =>
                                                                        vertices
                                                                            .array[
                                                                            i
                                                                        ]
                                                                )
                                                                .map(
                                                                    (
                                                                        holePoint,
                                                                        i
                                                                    ) =>
                                                                        `${
                                                                            i ===
                                                                            0
                                                                                ? " M "
                                                                                : "L "
                                                                        }${
                                                                            holePoint.x
                                                                        } ${-holePoint.y}`
                                                                )
                                                                .join(" ") +
                                                            " Z"
                                                    )
                                                    .join("")
                                        );
                                    } else {
                                        element.setAttribute(
                                            "points",
                                            shapeGeo.vertexIndices
                                                .map(i => vertices.array[i])
                                                .map(
                                                    point =>
                                                        `${point.x},${-point.y}`
                                                )
                                                .join(" ")
                                        );
                                    }

                                    const shapeColor = shape_color(
                                        material,
                                        shape_light(
                                            shapeGeo.WORLD.modelNormal,
                                            scene.ambientLight,
                                            scene.directionalLight
                                        )
                                    );

                                    if (shapeColor) {
                                        element.setAttribute(
                                            "fill",
                                            shapeColor
                                        );
                                    }

                                    if (material.opacity != null) {
                                        element.setAttribute(
                                            "opacity",
                                            String(material.opacity)
                                        );
                                    }
                                },
                                clearElement(element) {
                                    element.removeAttribute("d");
                                    element.removeAttribute("points");
                                },
                            };
                        });
                }) ?? []
        );
    }
}
