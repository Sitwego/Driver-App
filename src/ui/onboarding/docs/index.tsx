import { useCallback, useMemo, useState } from "react";
import { Pressable } from "react-native";
import ReactNativeBlobUtil from "react-native-blob-util";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import useFileUpload from "~/hooks/useFileUpload";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { OnboardingControls } from "../OnBoardingControls";
import {
  useOnboardingControls,
  FileUploadResponseType,
  isTwoOrThreeWheeler,
} from "../state";

import { CertificateOfGoodConduct } from "./CertificateOfGoodConduct";
import { IABottomSheetProps } from "./DocModalType";
import { useDocuments } from "./DocumentModalProvider";
import { DrivingLicense } from "./DrivingLicense";
import ImagePickerFormController from "./ImagePickerFormController";
import { IndentificationDocuments } from "./IndentificationDocuments";
import { Insurance } from "./Insurance";
import { KraPin } from "./KraPin";
import { PsvBadge } from "./PsvBadge";
import { VehicleInspectionSticker } from "./VehicleInspectionSticker";

function isUploaded(doc?: FileUploadResponseType) {
  return !!doc?.id && doc.id.trim() !== "";
}

type DocRowProps = {
  label: string;
  done: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
  required?: boolean;
};

function DocRow({
  label,
  done,
  colors,
  onPress,
  required = true,
}: DocRowProps) {
  return (
    <RnView style={[s.w100pct, s.gap6]}>
      <RnText>
        {label}
        {required ? (
          <RnText style={{ color: colors.notification, fontSize: 18 }}>
            {" "}
            *
          </RnText>
        ) : (
          <RnText style={{ color: colors.lightGray, fontSize: 14 }}>
            {" "}
            (optional)
          </RnText>
        )}
      </RnText>
      <Pressable
        style={[
          s.py40,
          s.px10,
          s.w100pct,
          s.flexDirectionRow,
          s.justifyBetween,
          {
            borderRadius: 10,
            backgroundColor: colors.lightBackground,
            borderWidth: 1,
            borderColor: done ? colors.success : colors.lightBackground,
          },
        ]}
        onPress={onPress}
      >
        <RnText style={{ color: done ? colors.success : colors.text }}>
          {done ? "Uploaded ✓" : "Tap to upload"}
        </RnText>
        <Icon
          name={done ? "CircleCheck" : "Circle"}
          size={20}
          color={done ? colors.success : colors.lightGray}
        />
      </Pressable>
    </RnView>
  );
}

export function Docs() {
  const { show } = useDocuments();
  const { dispatch, state } = useOnboardingControls();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { uploadFile, isUploading } = useFileUpload();
  const [profilePhoto, setProfilePhoto] = useState<{ uri: string }>();

  // Boda (Bike) & tuk-tuk (Auto) skip the PSV badge and inspection sticker but
  // must provide motorcycle/auto insurance instead.
  const isMotoOrAuto = isTwoOrThreeWheeler(state.vehicleDetails.vehicle_type);

  const docsStatus = useMemo(() => {
    const { docs } = state;
    return {
      profileImage: isUploaded(docs.profileImage),
      identityDocs:
        isUploaded(docs.idImageFront) &&
        isUploaded(docs.idImageBack) &&
        docs.idNo.trim() !== "",
      drivingLicense: isUploaded(docs.driverLicense),
      goodConduct: isUploaded(docs.certificateOfGoodConductFromDCI),
      psvBadge: isUploaded(docs.psvBadge),
      inspection: isUploaded(docs.inspection),
      insurance: isUploaded(docs.insurance),
      kraPin: isUploaded(docs.kraPin),
    };
  }, [state]);

  const allDocsUploaded = useMemo(() => {
    const required = [
      docsStatus.profileImage,
      docsStatus.identityDocs,
      docsStatus.drivingLicense,
      docsStatus.goodConduct,
      // Insurance is required for every vehicle type.
      docsStatus.insurance,
      // PSV badge + inspection apply to cars only.
      ...(isMotoOrAuto ? [] : [docsStatus.psvBadge, docsStatus.inspection]),
    ];
    return required.every(Boolean);
  }, [docsStatus, isMotoOrAuto]);

  const onContinue = useCallback(() => {
    if (allDocsUploaded) dispatch({ type: "next" });
  }, [allDocsUploaded, dispatch]);

  const handleUpload = useCallback(
    async (uri: string) => {
      const formData = [
        {
          name: "file",
          filename: "profile-photo",
          type: "image/png",
          data: ReactNativeBlobUtil.wrap(uri),
        },
      ];
      try {
        const res = await uploadFile({
          endPoint: "driver/upload-documents",
          formData,
        });
        if (res.data) {
          const { id, nonce, encrypted_key } = res.data;
          dispatch({
            type: "setDocs",
            docs: {
              ...state.docs,
              profileImage: { id, nonce, encrypted_key },
            },
            apiResponse: undefined,
          });
          setProfilePhoto({ uri });
        }
      } catch {
        // upload failed
      }
    },
    [dispatch, state.docs, uploadFile],
  );

  const showDocModal = useCallback(
    (type: IABottomSheetProps["type"], children: React.ReactNode) => {
      show({
        hasBackDrop: true,
        type,
        hasCancel: true,
        enablePanDownToClose: false,
        snaps: ["95%"],
        children,
      });
    },
    [show],
  );

  return (
    <RnView style={[s.align_start, s.justifyBetween]}>
      <RnView
        style={[
          s.w100pct,
          atoms.gap_sm,
          s.flexCol,
          { flexWrap: "wrap", marginTop: insets.top },
        ]}
      >
        <RnText style={[atoms.text_xl]}>Account Setup</RnText>
        <RnText
          style={[
            {
              lineHeight: 20,
              fontSize: 14,
              color: colors.lightGray,
              paddingBottom: 10,
            },
          ]}
        >
          Provide Documents
        </RnText>
        <RnView style={[s.w100pct, s.gap6]}>
          <RnText>
            Upload a profile image should match your id image.
            <RnText style={{ color: colors.notification, fontSize: 18 }}>
              *
            </RnText>
          </RnText>

          <ImagePickerFormController
            isProfileImage
            isUploading={isUploading}
            value={profilePhoto?.uri ?? ""}
            label="Profile Photo"
            onChange={handleUpload}
          />
        </RnView>

        <RnView style={{ marginVertical: 10 }} />

        <DocRow
          label="Identity Documents"
          done={docsStatus.identityDocs}
          colors={colors}
          onPress={() =>
            showDocModal("IndentityDocs", <IndentificationDocuments />)
          }
        />
        <DocRow
          label={
            isMotoOrAuto
              ? "Motorcycle Driving Licence (Class A)"
              : "Driving License"
          }
          done={docsStatus.drivingLicense}
          colors={colors}
          onPress={() => showDocModal("DriverLicense", <DrivingLicense />)}
        />
        <DocRow
          label="Police Clearance Certificate"
          done={docsStatus.goodConduct}
          colors={colors}
          onPress={() =>
            showDocModal(
              "CertificateOfGoodConduct",
              <CertificateOfGoodConduct />,
            )
          }
        />
        <DocRow
          label={
            isMotoOrAuto ? "Valid Motorcycle/Auto Insurance" : "PSV Insurance"
          }
          done={docsStatus.insurance}
          colors={colors}
          onPress={() => showDocModal("Insurance", <Insurance />)}
        />
        {!isMotoOrAuto && (
          <>
            <DocRow
              label="PSV Badge"
              done={docsStatus.psvBadge}
              colors={colors}
              onPress={() => showDocModal("PsvBadge", <PsvBadge />)}
            />
            <DocRow
              label="Vehicle Inspection Sticker"
              done={docsStatus.inspection}
              colors={colors}
              onPress={() =>
                showDocModal("InspectionSticker", <VehicleInspectionSticker />)
              }
            />
          </>
        )}
        <DocRow
          label="KRA PIN Certificate"
          done={docsStatus.kraPin}
          colors={colors}
          required={false}
          onPress={() => showDocModal("Kra", <KraPin />)}
        />
      </RnView>
      <OnboardingControls.Portal>
        <RnView
          style={[
            { marginBottom: insets.bottom },
            s.justifyCenter,
            s.alignCenter,
            s.py8,
          ]}
        >
          <Pressable
            onPress={onContinue}
            style={[
              s.p16,
              {
                width: "80%",
                backgroundColor: allDocsUploaded
                  ? colors.primary
                  : colors.lightBackground,
                borderRadius: 8,
              },
            ]}
          >
            <RnText
              style={[
                atoms.text_lg,
                s.textCenter,
                { color: allDocsUploaded ? colors.text : colors.disabledText },
              ]}
            >
              Continue
            </RnText>
          </Pressable>
          {!allDocsUploaded && (
            <RnText
              style={[atoms.text_xs, { color: colors.danger, marginTop: 6 }]}
            >
              Please upload all required documents to continue
            </RnText>
          )}
        </RnView>
      </OnboardingControls.Portal>
    </RnView>
  );
}
