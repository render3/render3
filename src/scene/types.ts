import type { Matrix } from "../geo/matrix";

export type PerspectiveCameraSettings = {
    type: "perspective";
    fovY: number;

    near: number;
    far: number;
};

export type OrthographicCameraSettings = {
    type: "orthographic";
    viewHeight: number;

    near: number;
    far: number;
};

export type CameraSettings =
    | (Pick<PerspectiveCameraSettings, "type"> &
          Partial<PerspectiveCameraSettings>)
    | (Pick<OrthographicCameraSettings, "type"> &
          Partial<OrthographicCameraSettings>);

export type Frustum = {
    left: number;
    right: number;
    bottom: number;
    top: number;
    near: number;
    far: number;
};

export type ViewportDims = {
    width: number;
    height: number;
    unit?: string;
};
export type Viewport = ViewportDims & { matrix: Matrix };
