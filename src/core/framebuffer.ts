import type { Matrix } from "../geo/matrix";
import type { Vector, Vertex } from "../geo/vector";
import type { Bounding } from "../scene/bounding";
import type { Group, Model } from "../scene/model";
import type { Camera } from "../scene/camera";
import { Object3D } from "../scene/model";
import type { ShapeWithNormal } from "../scene/shape";

// Interface of Data2D
export type Shape2D = {
    vertices: Vertex[];
    holes: Vertex[][];
    matrix3D: Matrix;
    width: number;
    height: number;
};

type ArrayObjectWrapper<T> = {
    array: T[];
};

export class ArrayLazyMap<T, R extends T> implements ArrayObjectWrapper<T> {
    private mappedArray: R[] | undefined;

    constructor(
        private readonly inputArrayWrapper: ArrayObjectWrapper<T>,
        private readonly mapper: (item: T) => R,
        private readonly filter?: (item: R) => boolean
    ) {}

    get array() {
        if (this.mappedArray) return this.mappedArray;
        this.mappedArray = this.inputArrayWrapper.array
            .map(this.mapper)
            .filter(this.filter ?? (i => i));
        return this.mappedArray;
    }
}

export type ShapeFrameBuffer = {
    readonly shape: ShapeWithNormal;
    vertexIndices: number[];
    holeVertexIndices: number[][];

    LOCAL: { data2D: Shape2D };
    WORLD: { modelNormal: Vector };
    EYE: { modelViewNormal: Vector; isBackFacing: boolean };
};

type ModelBuffer<ModelGeoExtra = unknown> = {
    modelFrameBuffer: ObjectFrameBuffer; // Give access to other spaces
    geo: ModelGeoExtra & {
        vertices: ArrayObjectWrapper<Vertex>;
        shapes: ShapeFrameBuffer[];
        bounding: Bounding;
    };
    attributes?: Map<string, string | number>;
};

export type ModelFrameBuffer = {
    readonly kind: "model";
    readonly model: Model;
} & FrameBufferPayload;

type GroupFrameBuffer = {
    readonly kind: "group";
    readonly model: Group;
} & FrameBufferPayload;

export type ObjectFrameBuffer = ModelFrameBuffer | GroupFrameBuffer;

export type FrameBufferPayload = {
    LOCAL: ModelBuffer;
    WORLD?: ModelBuffer<{
        modelMatrix: Matrix; // Transforms model to world space including translate, rotate and scale (from local space).
        modelNormalMatrix: Matrix; // Holds the rotation part of the modelMatrix, used to transform normals to world space.
    }>;
    EYE?: ModelBuffer<{
        modelViewMatrix: Matrix; // Transforms model to eye space (from local space).
        modelViewNormalMatrix: Matrix; // Holds the rotation part of the modelViewMatrix, used to transform normals to eye space.
    }>;

    PROJECTION?: ModelBuffer<{
        mvpMatrix: Matrix; // Transforms model to projection space (from local space).
    }>;
    CLIP?: ModelBuffer;
    NDC?: ModelBuffer;
    SCREEN?: ModelBuffer;
};

// A FrameBuffer contains all pieces of information we need to render a frame.
// The buffer has three purposes:
// 1. Caching - reuse calculated data which has not changed.
// 2. Post-processing - reuse data for additional artifacts
// 3. Head-/DOM-less processing - use the rendered data outside the lib instead of drawing it.
export class FrameBuffer {
    private readonly bufferLookup = new Map<
        Model | Group | Camera,
        ObjectFrameBuffer
    >();

    private readonly modelArray: ModelFrameBuffer[] = [];

    has(object: Model | Group | Camera) {
        return this.bufferLookup.has(object);
    }

    get(object: Model | Group | Camera) {
        return this.bufferLookup.get(object);
    }

    add(object: Model | Group | Camera, objectFrameBuffer: ObjectFrameBuffer) {
        if (this.has(object)) {
            throw new Error("Object is already in buffer");
        }

        this.bufferLookup.set(object, objectFrameBuffer);
        if (objectFrameBuffer.kind === "model") {
            this.modelArray.push(objectFrameBuffer);
        }
    }

    models() {
        return this.modelArray;
    }

    sort(compareFn: (a: ModelFrameBuffer, b: ModelFrameBuffer) => number) {
        this.modelArray.sort(compareFn);
    }

    /* -
    values<S extends keyof ModelFrameBuffer>(space: S) {
        return [...this.bufferLookup].map(
            ([, modelBuffer]) => modelBuffer[space]
        );
    }
    */

    // Only inject buffer data belonging to given models (buffer might contain old data)
    bufferModelsCallback<R>(
        objects: Array<Model | Group | Camera>,
        callback: (
            object: Model | Group | Camera,
            objectBuffer: ObjectFrameBuffer,
            parentObjectBuffer: ObjectFrameBuffer | undefined
        ) => R
    ): R[] {
        return objects.map(object => {
            const objectFrameBuffer = this.get(object);
            const parentObjectBuffer =
                object.parent instanceof Object3D
                    ? this.get(object.parent)
                    : undefined;

            if (objectFrameBuffer == null) {
                throw new Error("Object not found in FrameBuffer");
            }

            return callback(object, objectFrameBuffer, parentObjectBuffer);
        });
    }
}

export const defaultFrameBuffer = new FrameBuffer();
