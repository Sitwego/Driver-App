export type ImagePickerResponse = {
  height?: number;
  name: string;
  size?: number | null;
  type: string;
  uri: string;
  width?: number;
};

export type FileObject = Partial<File | ImagePickerResponse>;
