import { useCallback, useMemo, useRef, useState } from "react";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { DateFieldRef, DateInputField } from "~/ui/DateComponent";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { toSimpleDateString } from "~/utils/dates/simpleDateString";

import { FileUploadResponseType, useOnboardingControls } from "../state";

import { useDocuments } from "./DocumentModalProvider";
import { FooterButton } from "./FotterCButton";
import ImagePickerFormController from "./ImagePickerFormController";
import { createDocFormData } from "./uploadUtils";

type InspectionState = {
  inspectionUri: string;
  inspectionExpiry: string;
};

export function VehicleInspectionSticker() {
  const { uploadFile, isUploading } = useFileUpload();
  const { dispatch, state } = useOnboardingControls();
  const { colors } = useAppTheme();
  const { hide } = useDocuments();
  const dateRef = useRef<DateFieldRef>(null);

  const [inspection, setInspection] = useState<InspectionState>(() => ({
    inspectionUri: "",
    inspectionExpiry:
      state.docs.inspectionExpiry ?? toSimpleDateString(new Date()),
  }));
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "inspection-sticker"),
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          setDocumentData({ nonce, id, encrypted_key });
          setInspection((prev) => ({ ...prev, inspectionUri: uri }));
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const onDateChange = useCallback((date: string) => {
    setInspection((prev) => ({
      ...prev,
      inspectionExpiry: toSimpleDateString(date),
    }));
  }, []);

  const isAllFilled = useMemo(() => {
    return (
      inspection.inspectionUri.trim() !== "" &&
      inspection.inspectionExpiry.trim() !== "" &&
      !!docData
    );
  }, [inspection, docData]);

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        inspection: docData,
        inspectionExpiry: inspection.inspectionExpiry,
      },
      apiResponse: undefined,
    });
    hide();
  }, [dispatch, docData, hide, inspection.inspectionExpiry, state.docs]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        Vehicle Inspection Sticker
        <RnText style={{ color: colors.notification, fontSize: 18 }}>*</RnText>
      </RnText>

      <DateInputField
        inputRef={dateRef}
        value={inspection.inspectionExpiry}
        minimumDate={new Date()}
        onChangeDate={onDateChange}
        label="Inspection expiry date"
      />

      <ImagePickerFormController
        value={inspection.inspectionUri}
        label="Inspection Sticker Photo"
        onChange={handleUpload}
        isUploading={isUploading}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
