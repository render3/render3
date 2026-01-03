import type { DomNamespace, NSElement, NSTag } from "../types/dom";

export type ElementDescriptor<N extends DomNamespace> = {
    tag: NSTag<N>;
    style?: Partial<CSSStyleDeclaration>;
    attributes?: Record<string, string>;
};

// Renderer's toDom() output
export type DomNodeDefinition<N extends DomNamespace> = {
    // The element tag this definition is requesting in the DOM
    elementDescriptor: ElementDescriptor<N>;
    // Wrappers outside to inside, eg. [div, svg]
    elementWrappers: Array<ElementDescriptor<N>>; // TODO post-mvp: shouldn't be restricted to N.
    fillElement: (element: NSElement<N>) => void; // Leaf only
    clearElement: (element: NSElement<N>) => void; // Leaf only
};
