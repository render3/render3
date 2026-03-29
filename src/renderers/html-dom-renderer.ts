import type { Scene } from "../scene/scene";
import type { FrameBuffer } from "../core/framebuffer";
import type { DomNamespace } from "../types/dom";
import type { DomNodeDefinition } from "./pipeline-types";
import { HtmlDivContainer } from "./htmldiv-container";

export class HTMLDOMRenderer extends HtmlDivContainer<DomNamespace.XHTML> {
    override toDom(
        scene: Scene,
        frameBuffer: FrameBuffer
    ): Array<DomNodeDefinition<DomNamespace.XHTML>> {
        throw new Error("Method not implemented.");
    }
}
