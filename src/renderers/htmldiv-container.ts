import { createDomElement } from "../core/dom";
import { DomNamespace } from "../types/dom";
import type { RendererConfig } from "./renderer";
import { Renderer } from "./renderer";

export abstract class HtmlDivContainer<
    N extends DomNamespace
> extends Renderer<N> {
    constructor(
        namespace: N,
        optDomElement: HTMLElement | SVGElement | undefined | null, // eslint-disable-line @typescript-eslint/ban-types
        config: RendererConfig
    ) {
        const domElement =
            optDomElement ?? createDomElement(DomNamespace.XHTML, "div");

        super(namespace, domElement, config);
    }
}
