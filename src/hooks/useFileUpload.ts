import { useState, useCallback } from "react";
import ReactNativeBlobUtil from "react-native-blob-util";

import { useUserState } from "~/lib/state/userState";
import { getFileBaseUrl } from "~/utils/url";

export interface FormDataElement {
  name: string;
  filename?: string;
  type?: string;
  data: string | { [key: string]: any };
}

export interface UploadConfig {
  endPoint: string;
  headers?: { [key: string]: string };
  formData?: FormDataElement[];
}

export interface UploadResponse {
  data: any;
  status: number;
}

export interface UseFileUploadReturn {
  uploadFile: (config: UploadConfig) => Promise<UploadResponse>;
  isUploading: boolean;
  error: Error | null;
  response: UploadResponse | null;
}

const useFileUpload = (): UseFileUploadReturn => {
  const { token } = useUserState();
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState<UploadResponse | null>(null);

  const uploadFile = useCallback(
    async ({
      endPoint,
      headers = {},
      formData = [],
    }: UploadConfig): Promise<UploadResponse> => {
      setIsUploading(true);
      setError(null);
      setResponse(null);
      const url = `${getFileBaseUrl()}${endPoint}`;
      try {
        const res = await ReactNativeBlobUtil.fetch(
          "post",
          url,
          {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
            ...headers,
          },
          formData,
        );

        const responseData: UploadResponse = {
          data: typeof res.data === "string" ? JSON.parse(res.data) : undefined,
          status: res.respInfo.status,
          // we can map other relevant fields from res if needed
        };

        setResponse(responseData);
        return responseData;
      } catch (err: any) {
        setError(err);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [token],
  );

  return { uploadFile, isUploading, error, response };
};

export default useFileUpload;
