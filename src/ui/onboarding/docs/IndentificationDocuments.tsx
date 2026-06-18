import { Picker } from "@react-native-picker/picker";
import { useCallback, useMemo, useRef, useState } from "react";

import RnText from "~/components/RnText";
import RnTextInput from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { FileUploadResponseType, useOnboardingControls } from "../state";

import { useDocuments } from "./DocumentModalProvider";
import { FooterButton } from "./FotterCButton";
import ImagePickerFormController from "./ImagePickerFormController";
import { createDocFormData } from "./uploadUtils";

type IdDocsType = {
  idType: string;
  idNo: string;
  idImageFront: string;
  idImageBack: string;
};

export function IndentificationDocuments() {
  const { dispatch, state } = useOnboardingControls();
  const { hide } = useDocuments();
  const { uploadFile: uploadFront, isUploading: isUploadingFront } =
    useFileUpload();
  const { uploadFile: uploadBack, isUploading: isUploadingBack } =
    useFileUpload();
  const { colors, fonts } = useAppTheme();
  const pickerRef = useRef(null);

  const [idDocs, setIdDocs] = useState<IdDocsType>(() => ({
    idType: state.docs.idType ?? "national_id",
    idNo: state.docs.idNo,
    idImageFront: "",
    idImageBack: "",
  }));
  const [idFrontResponse, setIdFrontResponse] =
    useState<FileUploadResponseType>();
  const [idBackResponse, setIdBackResponse] =
    useState<FileUploadResponseType>();

  const isAllFilled = useMemo(() => {
    const { idType, idNo, idImageFront, idImageBack } = idDocs;
    const isIdNoValid =
      idNo.trim() !== "" && idNo.length >= 8 && idNo.length <= 12;
    return (
      idType.trim() !== "" &&
      isIdNoValid &&
      idImageFront.trim() !== "" &&
      idImageBack.trim() !== "" &&
      !!idFrontResponse &&
      !!idBackResponse
    );
  }, [idDocs, idFrontResponse, idBackResponse]);

  const _onIdImgFront = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadFront({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "id-front"),
        });
        if (res.data) {
          setIdDocs((prev) => ({ ...prev, idImageFront: uri }));
          setIdFrontResponse({
            id: res.data.id,
            nonce: res.data.nonce,
            encrypted_key: res.data.encrypted_key,
          });
        }
      } catch {
        // upload failed
      }
    },
    [uploadFront],
  );

  const _onIdImgBack = useCallback(
    async (uri: string) => {
      try {
        const res = await uploadBack({
          endPoint: "driver/upload-documents",
          formData: createDocFormData(uri, "id-back"),
        });
        if (res.data) {
          setIdDocs((prev) => ({ ...prev, idImageBack: uri }));
          setIdBackResponse({
            id: res.data.id,
            nonce: res.data.nonce,
            encrypted_key: res.data.encrypted_key,
          });
        }
      } catch {
        // upload failed
      }
    },
    [uploadBack],
  );

  const onIdNoChange = useCallback((id: string) => {
    setIdDocs((prev) => ({ ...prev, idNo: id }));
  }, []);

  const onIdTypeChange = useCallback((value: string) => {
    setIdDocs((prev) => ({ ...prev, idType: value }));
  }, []);

  const onSave = useCallback(() => {
    dispatch({
      type: "setDocs",
      docs: {
        ...state.docs,
        idType: idDocs.idType,
        idNo: idDocs.idNo,
        idImageFront: idFrontResponse as FileUploadResponseType,
        idImageBack: idBackResponse as FileUploadResponseType,
      },
      apiResponse: undefined,
    });
    hide();
  }, [
    dispatch,
    hide,
    idBackResponse,
    idDocs.idNo,
    idDocs.idType,
    idFrontResponse,
    state.docs,
  ]);

  return (
    <RnView style={[s.w100pct, atoms.gap_sm, s.flexCol, { flexWrap: "wrap" }]}>
      <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
        <RnText>
          Select document (ID) type{" "}
          <RnText style={{ color: colors.notification, fontSize: 18 }}>
            *
          </RnText>
        </RnText>
        <RnView
          style={[
            s.w100pct,
            {
              borderWidth: 1,
              borderColor: colors.lightBackground,
              borderRadius: 8,
            },
            s.py4,
            s.px4,
          ]}
        >
          <Picker
            ref={pickerRef}
            mode="dropdown"
            selectedValue={idDocs.idType}
            onValueChange={(itemValue) => {
              if (itemValue) onIdTypeChange(itemValue);
            }}
          >
            <Picker.Item
              style={{ fontSize: 20, fontFamily: fonts.medium.fontFamily }}
              label="National Identity Card (ID)"
              value="national_id"
            />
            <Picker.Item
              style={{ fontSize: 20, fontFamily: fonts.medium.fontFamily }}
              label="Passport"
              value="passport"
            />
          </Picker>
        </RnView>
      </RnView>
      <RnView style={[s.flexDirectionRow, { flexWrap: "wrap" }, s.gap6]}>
        <RnText>
          What is your Id Number
          <RnText style={{ color: colors.notification, fontSize: 18 }}>
            *
          </RnText>
        </RnText>
        <RnTextInput
          style={[
            s.input,
            s.f16,
            s.w100pct,
            {
              paddingLeft: 16,
              fontFamily: fonts.regular.fontFamily,
              color: colors.text,
              borderColor: colors.lightBackground,
            },
          ]}
          autoCorrect={false}
          cursorColor={colors.lightBackground}
          inputMode="numeric"
          maxLength={12}
          onChangeText={onIdNoChange}
          placeholder="289500000"
          placeholderTextColor={colors.lightGray}
          value={idDocs.idNo}
        />
        <ImagePickerFormController
          value={idDocs.idImageFront}
          label="Upload Id photo front"
          onChange={_onIdImgFront}
          isUploading={isUploadingFront}
        />
        <ImagePickerFormController
          value={idDocs.idImageBack}
          label="Upload Id photo back"
          onChange={_onIdImgBack}
          isUploading={isUploadingBack}
        />
      </RnView>
      <FooterButton disabled={isAllFilled} onClose={onSave} />
    </RnView>
  );
}
