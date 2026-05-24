export type ImageMeta = {
  path: string;
  width: number;
  height: number;
  mime: string;
};
export type PickerImage = ImageMeta & {
  size: number;
};
export interface Dimensions {
  width: number;
  height: number;
}

export interface PickerOpts {
  mediaType?: string;
  multiple?: boolean;
  maxFiles?: number;
}

export interface CameraOpts {
  width: number;
  height: number;
  freeStyleCropEnabled?: boolean;
  cropperCircleOverlay?: boolean;
}
