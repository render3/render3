import { Matrix } from "../geo/matrix";
import { Vector3 } from "../geo/vector";
import { Object3D } from "./model";
import type {
    CameraSettings,
    OrthographicCameraSettings,
    PerspectiveCameraSettings,
    Viewport,
    ViewportDims,
} from "./types";

const defaultPerspectiveSettings: PerspectiveCameraSettings = {
    type: "perspective",
    fovY: 50,

    near: 0.1,
    far: 1000,
};

const defaultOrthographicSettings: OrthographicCameraSettings = {
    type: "orthographic",
    viewHeight: 10,

    near: 1,
    far: 100,
};

export const defaultViewport: ViewportDims = {
    width: 800,
    height: 600,
};

// TODO post-mvp: zoom (factor)

export class Camera extends Object3D<Camera> {
    // TODO post-mvp: handle bsp explicit for Models instead of letting them be undefined in Group where they don't make sense
    _bsp = undefined;
    material = undefined;

    readonly settings: PerspectiveCameraSettings | OrthographicCameraSettings;
    readonly viewport: Viewport;
    readonly projectionMatrix: Matrix;

    private worldMatrix: Matrix | undefined;
    private _matrix = Matrix.identity;

    constructor(
        settings: CameraSettings = defaultPerspectiveSettings,
        viewport?: Partial<ViewportDims>
    ) {
        super("camera-id"); // TODO

        this.settings =
            settings.type === "perspective"
                ? {
                      ...defaultPerspectiveSettings,
                      ...settings,
                  }
                : {
                      ...defaultOrthographicSettings,
                      ...settings,
                  };

        const viewportDims = { ...defaultViewport, ...viewport };
        this.viewport = {
            ...viewportDims,
            matrix: Matrix.viewport(viewportDims),
        };

        /**
         * Right handedness (equal to OpenGL)
         *
         *     +y (index finger)
         *      |
         *      |____ +x (thumb)
         *     /
         *    /
         *  +z (bend)
         */

        // // Still right-handed (projection only flips the numerical depth range, not the handedness of the coordinate system)
        this.projectionMatrix =
            this.settings.type === "perspective"
                ? Matrix.perspective(this.settings, this.aspectRatio)
                : Matrix.ortho(this.settings, this.aspectRatio);
    }

    get aspectRatio() {
        return this.viewport.width / this.viewport.height;
    }

    // TODO: Rename to viewMatrix
    getModelMatrix(modelMatrix: Matrix) {
        if (this.worldMatrix?.equals(modelMatrix)) {
            return this._matrix;
        }

        this.worldMatrix = modelMatrix;
        this._matrix = modelMatrix.inverse();
        return this._matrix;
    }
}

export class PerspectiveCamera extends Camera {
    constructor(
        settings?: Partial<Omit<PerspectiveCameraSettings, "type">>,
        viewport?: Partial<ViewportDims>
    ) {
        super({ ...settings, type: "perspective" }, viewport);
    }
}

export class OrthographicCamera extends Camera {
    // The concept of "facing the camera" is still valid in orthographic projection,
    // but direction-based, not position-based (the camera does not converge to a point; no perspective divide).
    static directionToCamera = new Vector3(0, 0, 1);

    constructor(
        settings?: Omit<Partial<OrthographicCameraSettings>, "type">,
        viewport?: Partial<ViewportDims>
    ) {
        super({ ...settings, type: "orthographic" }, viewport);
    }
}
