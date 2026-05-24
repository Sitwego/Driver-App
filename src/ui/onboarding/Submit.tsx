import { PressableScale as Pressable } from "pressto";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import {
  useCreateDriverIdentityDocuments,
  useCreateVehicleDocuments,
  useCreateVehicleInfo,
  useSetDriverHasCompletedOnboarding,
} from "~/hooks/useOnboardingApi";
import { useSetDriverPhoto } from "~/hooks/useUserApi";
import { useUserApi } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";

import { useAppTheme } from "../theme/ThemeProvider";
import { atoms } from "../theme/atoms";

import { OnboardingControls } from "./OnBoardingControls";
import { useOnboardingControls } from "./state";
import { isControlsContextEmpty } from "./utils";
import { st } from "~/components/SubscriptionPlans";

type InfoRowProps = {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
};

function InfoRow({ label, value, colors }: InfoRowProps) {
  return (
    <RnView style={[s.flexDirectionRow, s.justifyBetween]}>
      <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
        {label}
      </RnText>
      <RnText
        style={[
          atoms.text_sm,
          atoms.font_bold,
          { textTransform: "capitalize" },
        ]}
      >
        {value || "—"}
      </RnText>
    </RnView>
  );
}

function DocCheckRow({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <RnView style={[s.flexDirectionRow, { gap: 10 }]}>
      <Icon name="CircleCheck" size={16} color={colors.success} />
      <RnText style={[atoms.text_sm]}>{label}</RnText>
    </RnView>
  );
}

export function SubmitData() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { state: _ } = useOnboardingControls();
  const { completeOnBoarding } = useUserApi();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { mutateAsync: indentityDocuments } =
    useCreateDriverIdentityDocuments();
  const { mutateAsync: cert_of_good_conduct } = useCreateVehicleDocuments();
  const { mutateAsync: drivingLicense } = useCreateVehicleDocuments();
  const { mutateAsync: psvBadge } = useCreateVehicleDocuments();
  const { mutateAsync: vehicle_info } = useCreateVehicleInfo();
  const { mutateAsync: setProfilePhoto } = useSetDriverPhoto();
  const { mutateAsync: setHasCompletedOnboarding } =
    useSetDriverHasCompletedOnboarding();

  const complete = useCallback(
    async function () {
      const state = _;
      setIsSubmitting(true);
      try {
        const good_conduct = {
          ...state.docs.certificateOfGoodConductFromDCI,
          expiry: state.docs.certificateOfGoodConductExpiry,
          document_type: "CertificateOfGoodConduct",
        };
        const dl = {
          ...state.docs.driverLicense,
          expiry: state.docs.dlExpiry,
          document_type: "DrivingLicense",
        };
        const psv = {
          ...state.docs.psvBadge,
          expiry: state.docs.psvBadgeExpiry,
          document_type: "PsvBadge",
        };
        const identuty_document = {
          id_number: state.docs.idNo,
          id_type: state.docs.idType,
          file_id_back: state.docs.idImageBack.id,
          back_nonce: state.docs.idImageBack.nonce,
          file_id_front: state.docs.idImageFront.id,
          front_nonce: state.docs.idImageFront.nonce,
          back_encrypted_key: state.docs.idImageBack.encrypted_key,
          front_encrypted_key: state.docs.idImageFront.encrypted_key,
        };
        const profile_photo = {
          photo_id: state.docs.profileImage.id,
          photo_nonce: state.docs.profileImage.nonce,
          photo_encrypted_key: state.docs.profileImage.encrypted_key,
        };

        const results = await Promise.allSettled([
          indentityDocuments(identuty_document),
          vehicle_info({ ...state.vehicleDetails }),
          setProfilePhoto(profile_photo),
        ]);

        await cert_of_good_conduct(good_conduct);
        await drivingLicense(dl);
        await psvBadge(psv);

        const hasErrors = results.some((r) => r.status === "rejected");
        if (!hasErrors) {
          await setHasCompletedOnboarding({ hasOnboarded: true });
          completeOnBoarding({ hasOnboarded: true });
        }
      } catch {
        // submission failed
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      _,
      cert_of_good_conduct,
      completeOnBoarding,
      drivingLicense,
      indentityDocuments,
      psvBadge,
      setHasCompletedOnboarding,
      setProfilePhoto,
      vehicle_info,
    ],
  );

  const isComplete = useMemo(() => !isControlsContextEmpty(_), [_]);
  const { vehicleDetails } = _;

  return (
    <RnView style={[s.flex1]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.px16, { gap: 20, paddingTop: 12 }]}
      >
        <RnView style={[{ gap: 6 }]}>
          <RnText style={[atoms.text_3xl, atoms.font_bold]}>
            Almost There!
          </RnText>
          <RnText
            style={[atoms.text_sm, { color: colors.lightGray, lineHeight: 20 }]}
          >
            Review your details and submit to complete your registration.
          </RnText>
        </RnView>

        <RnView
          style={[
            s.p16,
            atoms.rounded_md,
            { backgroundColor: colors.lightBackground, gap: 12 },
          ]}
        >
          <RnView style={[s.flexDirectionRow, { gap: 8 }]}>
            <Icon name="Car" size={18} color={colors.primary} />
            <RnText style={[atoms.text_md, atoms.font_bold]}>
              Vehicle Details
            </RnText>
          </RnView>
          <RnView
            style={[styles.divider, { backgroundColor: colors.border }]}
          />
          <RnView style={[{ gap: 10 }]}>
            <InfoRow
              label="Make & Model"
              value={`${vehicleDetails.make} ${vehicleDetails.model}`}
              colors={colors}
            />
            <InfoRow
              label="Year"
              value={String(vehicleDetails.year)}
              colors={colors}
            />
            <InfoRow
              label="Color"
              value={vehicleDetails.color}
              colors={colors}
            />
            <InfoRow
              label="License Plate"
              value={vehicleDetails.license_plate}
              colors={colors}
            />
            <InfoRow
              label="Capacity"
              value={`${vehicleDetails.capacity} passengers`}
              colors={colors}
            />
            <InfoRow
              label="Type"
              value={vehicleDetails.vehicle_type}
              colors={colors}
            />
          </RnView>
        </RnView>

        <RnView
          style={[
            s.p16,
            atoms.rounded_md,
            { backgroundColor: colors.lightBackground, gap: 12 },
          ]}
        >
          <RnView style={[s.flexDirectionRow, { gap: 8 }]}>
            <Icon name="FileCheck" size={18} color={colors.primary} />
            <RnText style={[atoms.text_md, atoms.font_bold]}>
              Submitted Documents
            </RnText>
          </RnView>
          <RnView
            style={[styles.divider, { backgroundColor: colors.border }]}
          />
          <RnView style={[{ gap: 12 }]}>
            <DocCheckRow label="Identity Document" colors={colors} />
            <DocCheckRow label="Profile Photo" colors={colors} />
            <DocCheckRow label="Driving License" colors={colors} />
            <DocCheckRow label="Certificate of Good Conduct" colors={colors} />
            <DocCheckRow label="PSV Badge" colors={colors} />
          </RnView>
        </RnView>
      </ScrollView>

      <OnboardingControls.Portal>
        <RnView
          style={[
            { marginBottom: insets.bottom },
            s.justifyCenter,
            s.alignCenter,
            s.py8,
            { gap: 6 },
          ]}
        >
          <Pressable
            onPress={complete}
            enabled={isComplete && !isSubmitting}
            style={[
              s.p16,
              {
                width: "80%",
                backgroundColor: isComplete
                  ? colors.primary
                  : colors.lightBackground,
                borderRadius: 8,
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Icon
                name="Send"
                size={18}
                color={isComplete ? colors.text : colors.disabledText}
              />
            )}
            <RnText
              style={[
                atoms.text_lg,
                s.textCenter,
                { color: isComplete ? colors.text : colors.disabledText },
              ]}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </RnText>
          </Pressable>
          {!isComplete && (
            <RnText style={[atoms.text_xs, { color: colors.danger }]}>
              Please complete all steps before submitting
            </RnText>
          )}
        </RnView>
      </OnboardingControls.Portal>
    </RnView>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
