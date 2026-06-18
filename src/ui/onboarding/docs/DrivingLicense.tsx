import { useCallback, useMemo, useRef, useState } from "react";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { DateFieldRef, DateInputField } from "~/ui/DateComponent";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { toSimpleDateString } from "~/utils/dates/simpleDateString";

import { FileUploadResponseType, useOnboardingControls } from "../state";

import { DriverLicenseInputType } from "./DocModalType";
import { useDocuments } from "./DocumentModalProvider";
import { FooterButton } from "./FotterCButton";
import ImagePickerFormController from "./ImagePickerFormController";
import { createDocFormData } from "./uploadUtils";

export function DrivingLicense() {
  const { uploadFile, isUploading } = useFileUpload();
  const { dispatch, state } = useOnboardingControls();
  const { colors } = useAppTheme();
  const { hide } = useDocuments();
  const dateRef = useRef<DateFieldRef>(null);

  const [dl, setDlState] = useState<DriverLicenseInputType>(() => ({
    dlExpiry: state.docs?.dlExpiry ?? toSimpleDateString(new Date()),
    driverLicense: "",
  }));
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "driving-license"),
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          setDocumentData({ nonce, id, encrypted_key });
          setDlState((prev) => ({ ...prev, driverLicense: uri }));
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const onDateChange = useCallback((date: string) => {
    setDlState((prev) => ({ ...prev, dlExpiry: toSimpleDateString(date) }));
  }, []);

  const isAllFilled = useMemo(() => {
    const { driverLicense, dlExpiry } = dl;
    return driverLicense.trim() !== "" && dlExpiry.trim() !== "" && !!docData;
  }, [dl, docData]);

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        dlExpiry: dl.dlExpiry,
        driverLicense: docData,
      },
      apiResponse: undefined,
    });
    hide();
  }, [dispatch, dl.dlExpiry, docData, hide, state.docs]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        Driving License expiry date
        <RnText style={{ color: colors.notification, fontSize: 18 }}>*</RnText>
      </RnText>

      <DateInputField
        inputRef={dateRef}
        value={dl.dlExpiry}
        minimumDate={new Date()}
        onChangeDate={onDateChange}
        label="Dl expiry date"
      />

      <ImagePickerFormController
        value={dl.driverLicense ?? ""}
        label="Document Photo"
        onChange={handleUpload}
        isUploading={isUploading}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
