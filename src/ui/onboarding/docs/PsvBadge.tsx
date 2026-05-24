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

type PsvBadgeTypes = {
  psvBadgeExpiry: string;
  psvBadge: string;
};

export function PsvBadge() {
  const { uploadFile } = useFileUpload();
  const { dispatch, state } = useOnboardingControls();
  const { hide } = useDocuments();
  const { colors } = useAppTheme();
  const dateRef = useRef<DateFieldRef>(null);

  const [psv, setPsv] = useState<PsvBadgeTypes>(() => ({
    psvBadge: "",
    psvBadgeExpiry: state.docs.psvBadgeExpiry,
  }));
  const [docData, setDocumentData] = useState<FileUploadResponseType>();

  const handleUpload = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "psv-badge"),
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          setDocumentData({ nonce, id, encrypted_key });
          setPsv((prev) => ({ ...prev, psvBadge: uri }));
        }
      } catch {
        // upload failed
      }
    },
    [uploadFile],
  );

  const onDateChange = useCallback((date: string) => {
    setPsv((prev) => ({ ...prev, psvBadgeExpiry: toSimpleDateString(date) }));
  }, []);

  const isAllFilled = useMemo(() => {
    const { psvBadge, psvBadgeExpiry } = psv;
    return psvBadge.trim() !== "" && psvBadgeExpiry.trim() !== "" && !!docData;
  }, [docData, psv]);

  const onSave = useCallback(async () => {
    if (!docData) return;
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        psvBadge: docData,
        psvBadgeExpiry: psv.psvBadgeExpiry,
      },
      apiResponse: undefined,
    });
    hide();
  }, [dispatch, docData, hide, psv.psvBadgeExpiry, state.docs]);

  return (
    <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
      <RnText>
        Provide PSV Badge expiry date
        <RnText style={{ color: colors.notification, fontSize: 18 }}>*</RnText>
      </RnText>

      <DateInputField
        inputRef={dateRef}
        value={psv.psvBadgeExpiry}
        minimumDate={new Date()}
        onChangeDate={onDateChange}
        label="PSV badge expiry"
      />

      <ImagePickerFormController
        value={psv.psvBadge}
        label="Document Photo"
        onChange={handleUpload}
      />
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
