import type {
    DomNodeDefinition,
    ElementDescriptor,
} from "../renderers/pipeline-types";
import type { DomNamespace, NSElement, NSTag } from "../types/dom";
import { objectEntries } from "../utils/ts-util";
import { removeArrayItem } from "../utils/utils";

/**
 * This class aims to batch all DOM operations and reuse existing nodes
 * causing appendChild to only move nodes instead of adding.
 */
export class Dom<N extends DomNamespace> {
    public readonly vDom: Array<VDomNode<N>> = [];

    constructor(
        private readonly namespace: N,
        readonly container: HTMLElement | SVGElement
    ) {}

    /**
     * Replace DOM nodes
     */
    update(domNodeDefs: Array<DomNodeDefinition<N>>): void {
        const leavesCopy = [...this.vDom];

        for (const def of domNodeDefs) {
            const leafNode = leavesCopy.find(
                domNode => domNode.tag === def.elementDescriptor.tag
            );

            // Found DOM element to reuse
            if (leafNode) {
                def.fillElement(leafNode.element);
                applyElementDescriptor(leafNode.element, def.elementDescriptor);
                // Update wrapper elements too. Especially width and height attrs are important.
                def.elementWrappers.reduceRight(
                    (wrapperElement, wrapperDescriptor) => {
                        if (wrapperElement) {
                            applyElementDescriptor(
                                wrapperElement,
                                wrapperDescriptor
                            );
                        }

                        return wrapperElement?.parentElement as
                            | NSElement<N>
                            | undefined;
                    },
                    leafNode.element.parentElement as NSElement<N> | undefined
                );

                removeArrayItem(leavesCopy, leafNode);
            }
            // No DOM element to reuse, making a new one
            else {
                // Update DOM
                const elementDescriptorTree = [
                    ...def.elementWrappers,
                    def.elementDescriptor,
                ];

                let rootElement: NSElement<N> | undefined;
                elementDescriptorTree.reduce(
                    (
                        parentElement: NSElement<N> | undefined,
                        elementDescriptor,
                        index
                    ) => {
                        // Top down
                        const newElement = createDomElement(
                            this.namespace,
                            elementDescriptor.tag
                        );

                        applyElementDescriptor(newElement, elementDescriptor);

                        if (rootElement == null) {
                            rootElement = newElement;
                        }

                        // Connect parentElement before fillElement() is called letting renderer access it.
                        if (parentElement) {
                            const parentElement_ =
                                parentElement as unknown as Element;
                            parentElement_.append(newElement as Element);
                        }

                        if (index === elementDescriptorTree.length - 1) {
                            def.fillElement(newElement);

                            // Update vDOM
                            const newDomNode = new VDomNode(
                                elementDescriptor.tag,
                                newElement,
                                () => {
                                    def.clearElement(newElement);
                                }
                            );
                            this.vDom.push(newDomNode);
                        }

                        return newElement;
                    },
                    undefined
                );

                this.container.append(rootElement as Element);
            }
        }

        // Clearing all DOM elements we didn't reuse
        for (const unusedDomNode of leavesCopy) {
            unusedDomNode.clearElement();
        }
    }
}

const applyElementDescriptor = <N extends DomNamespace>(
    element: NSElement<N>,
    descriptor: ElementDescriptor<N>
) => {
    // Set style
    Object.assign(element.style, descriptor.style);

    // Set attributes
    if (descriptor.attributes) {
        for (const [qualifiedName, value] of objectEntries(
            descriptor.attributes
        )) {
            element.setAttribute(qualifiedName, value);
        }
    }
};

class VDomNode<N extends DomNamespace> {
    constructor(
        readonly tag: NSTag<N>,
        readonly element: NSElement<N>,
        readonly clearElement: () => void
    ) {}
}

export const createDomElement = <N extends DomNamespace>(
    namespace: N,
    qualifiedName: NSTag<N>
): NSElement<N> => {
    const element = globalThis.window.document.createElementNS(
        namespace,
        qualifiedName as string
    );

    return element as NSElement<N>;
};
