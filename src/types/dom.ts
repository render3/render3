export enum DomNamespace {
    XHTML = "http://www.w3.org/1999/xhtml",
    SVG = "http://www.w3.org/2000/svg",
}

type NSBaseElement = {
    [DomNamespace.XHTML]: HTMLElement;
    [DomNamespace.SVG]: SVGElement;
};

export type NSElement<N extends DomNamespace> = NSBaseElement[N];

type NSTagNameMap = {
    [DomNamespace.XHTML]: HTMLElementTagNameMap;
    [DomNamespace.SVG]: SVGElementTagNameMap;
};

export type NSTag<N extends DomNamespace> = keyof NSTagNameMap[N];

export type Tag = keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap;
