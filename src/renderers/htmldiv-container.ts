import { createDomElement } from "../core/dom";
import { DomNamespace } from "../types/dom";
import type { RendererConfig } from "./renderer";
import { Renderer } from "./renderer";

export abstract class HtmlDivContainer<
    N extends DomNamespace
> extends Renderer<N> {
    constructor(
        namespace: N,
        optDomElement: HTMLElement | SVGElement | undefined,
        config: RendererConfig
    ) {
        const domElement =
            optDomElement ?? createDomElement(DomNamespace.XHTML, "div");

        super(namespace, domElement, config);
    }
}
