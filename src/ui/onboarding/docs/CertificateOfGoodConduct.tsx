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

type CertificateOfGoodConductType = {
  certificateOfGoodConductExpiry: string;
  certificateOfGoodConductFromDCI: string;
};

export function CertificateOfGoodConduct() {
  const { dispatch, state } = useOnboardingControls();
  const { hide } = useDocuments();
  const { uploadFile } = useFileUpload();
  const { colors } = useAppTheme();
  const dateRef = useRef<DateFieldRef>(null);

  const [cert, setCert] = useState<CertificateOfGoodConductType>(() => ({
    certificateOfGoodConductExpiry: state.docs.certificateOfGoodConductExpiry,
    certificateOfGoodConductFromDCI: "",
  }));
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "certificate-of-good-conduct"),
        });
        if (res.data) {
          setDocumentData({
            id: res.data.id,
            nonce: res.data.nonce,
            encrypted_key: res.data.encrypted_key,
          });
          setCert((prev) => ({
            ...prev,
            certificateOfGoodConductFromDCI: uri,
          }));
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const isAllFilled = useMemo(() => {
    const { certificateOfGoodConductExpiry, certificateOfGoodConductFromDCI } =
      cert;
    return (
      certificateOfGoodConductExpiry.trim() !== "" &&
      certificateOfGoodConductFromDCI.trim() !== "" &&
      !!docData
    );
  }, [cert, docData]);

  const onDateChange = useCallback((date: string) => {
    setCert((prev) => ({
      ...prev,
      certificateOfGoodConductExpiry: toSimpleDateString(date),
    }));
  }, []);

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        certificateOfGoodConductExpiry: cert.certificateOfGoodConductExpiry,
        certificateOfGoodConductFromDCI: docData,
      },
      apiResponse: undefined,
    });
    hide();
  }, [
    cert.certificateOfGoodConductExpiry,
    dispatch,
    docData,
    hide,
    state.docs,
  ]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        Police Clearance Certificate and expiry date
        <RnText style={{ color: colors.notification, fontSize: 18 }}>*</RnText>
      </RnText>

      <DateInputField
        inputRef={dateRef}
        value={cert.certificateOfGoodConductExpiry}
        minimumDate={new Date()}
        onChangeDate={onDateChange}
        label="Certificate Expiry date"
      />

      <ImagePickerFormController
        value={cert.certificateOfGoodConductFromDCI}
        label="Document Photo"
        onChange={handleUpload}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
