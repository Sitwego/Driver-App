import { useCallback, useMemo, useState } from "react";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

import { FileUploadResponseType, useOnboardingControls } from "../state";

import { useDocuments } from "./DocumentModalProvider";
import { FooterButton } from "./FotterCButton";
import ImagePickerFormController from "./ImagePickerFormController";
import { createDocFormData } from "./uploadUtils";

export function KraPin() {
  const { uploadFile, isUploading } = useFileUpload();
  const { dispatch, state } = useOnboardingControls();
  const { colors } = useAppTheme();
  const { hide } = useDocuments();

  const [kraUri, setKraUri] = useState("");
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "kra-pin"),
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          setDocumentData({ nonce, id, encrypted_key });
          setKraUri(uri);
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const isAllFilled = useMemo(
    () => kraUri.trim() !== "" && !!docData,
    [docData, kraUri],
  );

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        kraPin: docData,
      },
      apiResponse: undefined,
    });
    hide();
  }, [dispatch, docData, hide, state.docs]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        KRA PIN certificate
        <RnText style={{ color: colors.lightGray, fontSize: 14 }}>
          {" "}
          (optional)
        </RnText>
      </RnText>

      <ImagePickerFormController
        value={kraUri}
        label="KRA PIN Certificate Photo"
        onChange={handleUpload}
        isUploading={isUploading}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
