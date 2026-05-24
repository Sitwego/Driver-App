import ReactNativeBlobUtil from "react-native-blob-util";

import { FormDataElement } from "~/hooks/useFileUpload";

export function createDocFormData(
  uri: string,
  filename: string,
): FormDataElement[] {
  return [
    {
      name: "file",
      filename,
      type: "image/jpg",
      data: ReactNativeBlobUtil.wrap(uri),
    },
  ];
}
