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

        setViewBox(domElement);
        new ResizeObserver(() => {
            setViewBox(domElement);
        }).observe(domElement);

        super(DomNamespace.SVG, domElement, config);
    }
}

const setViewBox = (domElement: SVGElement) => {
    domElement.setAttribute(
        "viewBox",
        `${-domElement.clientWidth / 2} ${-domElement.clientHeight / 2} ${
            domElement.clientWidth
        } ${domElement.clientHeight}`
    );
};
