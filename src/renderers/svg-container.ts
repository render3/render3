import { createDomElement } from "../core/dom";
import { DomNamespace } from "../types/dom";
import type { RendererConfig } from "./renderer";
import { Renderer } from "./renderer";

export abstract class SVGContainer extends Renderer<DomNamespace.SVG> {
    constructor(
        optDomElement: SVGElement | undefined | null, // eslint-disable-line @typescript-eslint/ban-types
        config: RendererConfig
    ) {
        const domElement =
            optDomElement ?? createDomElement(DomNamespace.SVG, "svg");
        const { viewport } = config;

        if (!domElement.getAttribute("viewBox")) {
            domElement.setAttribute(
                "viewBox",
                `${-viewport.width / 2} ${-viewport.height / 2} ${
                    viewport.width
                } ${viewport.height}`
            );
        }

        super(DomNamespace.SVG, domElement, config);
    }
}
