import { useCallback, useMemo, useRef, useState } from "react";

import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { DateFieldRef, DateInputField } from "~/ui/DateComponent";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { toSimpleDateString } from "~/utils/dates/simpleDateString";

import {
  FileUploadResponseType,
  isTwoOrThreeWheeler,
  useOnboardingControls,
} from "../state";

import { useDocuments } from "./DocumentModalProvider";
import { FooterButton } from "./FotterCButton";
import ImagePickerFormController from "./ImagePickerFormController";
import { createDocFormData } from "./uploadUtils";

type InsuranceState = {
  insuranceUri: string;
  insuranceExpiry: string;
};

export function Insurance() {
  const { uploadFile, isUploading } = useFileUpload();
  const { dispatch, state } = useOnboardingControls();
  const { colors } = useAppTheme();
  const { hide } = useDocuments();
  const dateRef = useRef<DateFieldRef>(null);

  const insuranceLabel = isTwoOrThreeWheeler(state.vehicleDetails.vehicle_type)
    ? "Motorcycle / Auto insurance"
    : "PSV insurance";

  const [insurance, setInsurance] = useState<InsuranceState>(() => ({
    insuranceUri: "",
    insuranceExpiry:
      state.docs.insuranceExpiry ?? toSimpleDateString(new Date()),
  }));
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "vehicle-insurance"),
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          setDocumentData({ nonce, id, encrypted_key });
          setInsurance((prev) => ({ ...prev, insuranceUri: uri }));
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const onDateChange = useCallback((date: string) => {
    setInsurance((prev) => ({
      ...prev,
      insuranceExpiry: toSimpleDateString(date),
    }));
  }, []);

  const isAllFilled = useMemo(() => {
    return (
      insurance.insuranceUri.trim() !== "" &&
      insurance.insuranceExpiry.trim() !== "" &&
      !!docData
    );
  }, [insurance, docData]);

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        insurance: docData,
        insuranceExpiry: insurance.insuranceExpiry,
      },
      apiResponse: undefined,
    });
    hide();
  }, [dispatch, docData, hide, insurance.insuranceExpiry, state.docs]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        {insuranceLabel} expiry date
        <RnText style={{ color: colors.notification, fontSize: 18 }}>*</RnText>
      </RnText>

      <DateInputField
        inputRef={dateRef}
        value={insurance.insuranceExpiry}
        minimumDate={new Date()}
        onChangeDate={onDateChange}
        label="Insurance expiry date"
      />

      <ImagePickerFormController
        value={insurance.insuranceUri}
        label="Insurance Document Photo"
        onChange={handleUpload}
        isUploading={isUploading}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
