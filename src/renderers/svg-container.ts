import { createDomElement } from "../core/dom";
import { DomNamespace } from "../types/dom";
import type { RendererConfig } from "./renderer";
import { Renderer } from "./renderer";

export abstract class SVGContainer extends Renderer<DomNamespace.SVG> {
    constructor(
        optDomElement: HTMLElement | SVGElement | undefined,
        config: RendererConfig
    ) {
        const domElement =
            optDomElement ?? createDomElement(DomNamespace.SVG, "svg");
        const { viewport } = config;

        const domElementWidth = Number.parseInt(
            domElement.getAttribute("width") ?? ""
        );
        const domElementHeight = Number.parseInt(
            domElement.getAttribute("height") ?? ""
        );

        if (domElementWidth && domElementWidth !== viewport.width) {
            console.warn(
                `domElement width ${domElementWidth} and viewport width ${viewport.width} don't match.`
            );
        }

        if (domElementHeight && domElementHeight !== viewport.height) {
            console.warn(
                `domElement height ${domElementHeight} and viewport height ${viewport.height} don't match.`
            );
        }

        domElement.setAttribute("width", String(viewport.width));
        domElement.setAttribute("height", String(viewport.height));
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
