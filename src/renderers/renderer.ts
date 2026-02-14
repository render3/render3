import { calculateSpaceInBuffer } from "../core/buffer-pipeline";
import { Dom } from "../core/dom";
import { defaultFrameBuffer } from "../core/framebuffer";
import type { FrameBuffer } from "../core/framebuffer";
import { Camera } from "../scene/camera";
import type { Scene } from "../scene/scene";
import { topoSort } from "../scene/toposort";
import type { ViewportDims } from "../scene/types";
import type { DomNamespace } from "../types/dom";
import { Space, type SpaceKey } from "../types/spaces";
import { objectKeys } from "../utils/ts-util";
import type { DomNodeDefinition } from "./pipeline-types";

export type RendererInputOptions = {
    domElement: HTMLElement | SVGElement | null; // eslint-disable-line @typescript-eslint/ban-types
    viewport: ViewportDims;
    backfaceCulling: boolean;
};

export type RendererVSD = {
    culling?: {
        "frustum-side"?: boolean;
        "frustum-far"?: boolean;
        backface?: boolean;
    };
};

export type RendererConfig = {
    viewport: ViewportDims;
    vsd: RendererVSD;
};

const defaultCamera = new Camera({ type: "perspective" });

export abstract class Renderer<N extends DomNamespace> {
    protected readonly pipelineTarget: SpaceKey = "SCREEN"; // eslint-disable-line @typescript-eslint/class-literal-property-style

    private readonly dom: Dom<N>;

    constructor(
        readonly namespace: N,
        readonly domElement: HTMLElement | SVGElement,
        readonly config: RendererConfig
    ) {
        this.dom = new Dom(namespace, domElement);
    }

    render(scene: Scene, camera?: Camera, buffer?: FrameBuffer): void {
        camera ??= defaultCamera;
        const frameBuffer = buffer ?? defaultFrameBuffer;

        if (camera.parent == null) {
            scene.add(camera);
        }

        for (const spaceKey of objectKeys(Space)) {
            if (Space[spaceKey] > Space[this.pipelineTarget]) break;

            calculateSpaceInBuffer(
                spaceKey,
                scene,
                camera,
                frameBuffer,
                this.config
            );
        }

        const sortMap = topoSort(frameBuffer.models(), camera);

        // TODO post-mvp: perf - we are sorting twice (toposort first and then on its result)
        frameBuffer.sort((a, b) => {
            return (sortMap.get(a) ?? 0) - (sortMap.get(b) ?? 0);
        });

        if (buffer) {
            throw new Error("Not implemented");

            // TODO mvp:
            // - buffer.copyFrom(defaultFrameBuffer);
        } else {
            this.draw(scene, defaultFrameBuffer);
        }
    }

    abstract toDom(
        scene: Scene,
        frameBuffer: FrameBuffer
    ): Array<DomNodeDefinition<N>>;

    private draw(scene: Scene, frameBuffer: FrameBuffer) {
        this.dom.update(this.toDom(scene, frameBuffer));
    }
}
