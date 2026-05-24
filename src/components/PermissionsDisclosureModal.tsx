import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { themes } from "~/ui/theme/theme_utils";
import { borderRadius, fontFamily, space } from "~/ui/theme/tokens";

type Step = "permissions" | "background-location";

interface Props {
  visible: boolean;
  onForegroundRequest: () => Promise<void>;
  onRequestBackground: () => void;
  onSkipBackground: () => void;
}

const PERMISSION_ITEMS = [
  {
    icon: "MapPin" as const,
    label: "Location",
    required: true,
    description:
      "This app collects location data to enhance your use of our apps, including to improve pick-up locations, enable safety features, and prevent and detect fraud even when the app is closed or not in use.",
  },
  {
    icon: "Bell" as const,
    label: "Notifications",
    required: true,
    description:
      "Receive Job Cards (bookings) from riders, messages they send, important updates and announcements",
  },
  {
    icon: "FolderPlus" as const,
    label: "Storage",
    required: false,
    description: "Storage of documents uploaded in the registration process.",
  },
  {
    icon: "Camera" as const,
    label: "Camera",
    required: false,
    description:
      "Taking profile pictures and photos of documents to be submitted.",
  },
] as const;

export default function PermissionsDisclosureModal({
  visible,
  onForegroundRequest,
  onRequestBackground,
  onSkipBackground,
}: Props) {
  const [step, setStep] = useState<Step>("permissions");

  const handleStep1Confirm = async () => {
    await onForegroundRequest();
    setStep("background-location");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      {step === "permissions" ? (
        <PermissionsStep onConfirm={handleStep1Confirm} />
      ) : (
        <BackgroundLocationStep
          onConfirm={onRequestBackground}
          onCancel={onSkipBackground}
        />
      )}
    </Modal>
  );
}

function PermissionsStep({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <RnText style={styles.title} fontFamily={fontFamily.medium}>
          Request for Permissions
        </RnText>

        {PERMISSION_ITEMS.map((item) => (
          <View key={item.label} style={styles.permissionItem}>
            <View
              style={[styles.iconCircle, { backgroundColor: colors.primary }]}
            >
              <Icon name={item.icon} size={24} color="#fff" />
            </View>
            <View style={styles.permissionContent}>
              <View style={styles.labelRow}>
                <RnText
                  style={styles.permissionLabel}
                  fontFamily={fontFamily.medium}
                >
                  {item.label}
                </RnText>
                <RnText
                  style={styles.badge}
                  color={item.required ? "#888" : "#aaa"}
                >
                  {" "}
                  ({item.required ? "Required" : "Optional"})
                </RnText>
              </View>
              <RnText style={styles.permissionDesc}>{item.description}</RnText>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomPad}>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={onConfirm}
        >
          <RnText
            style={styles.confirmButtonText}
            fontFamily={fontFamily.medium}
            color="#fff"
          >
            Confirm
          </RnText>
        </Pressable>
      </View>
    </View>
  );
}

function BackgroundLocationStep({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.overlay}>
      <View style={[styles.dialog, { backgroundColor: colors.background }]}>
        <RnText style={styles.dialogTitle} fontFamily={fontFamily.medium}>
          Background Location{"\n"}Permission Required
        </RnText>

        <RnText style={styles.dialogDesc}>
          To ensure accurate fare calculation and reliable ride tracking even if
          the app has been closed or stopped, please select &apos;Allow all the
          time&apos; for background location access.
        </RnText>

        <View style={styles.dialogButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: themes.bg_900, opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onCancel}
          >
            <RnText fontFamily={fontFamily.medium}>Cancel</RnText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={onConfirm}
          >
            <RnText fontFamily={fontFamily.medium} color="#fff">
              Confirm
            </RnText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  scrollContent: {
    padding: space.xl,
    paddingTop: Platform.OS === "ios" ? 64 : space._5xl,
    paddingBottom: space.lg,
  },
  title: {
    fontSize: 30,
    lineHeight: 40,
    marginBottom: space._3xl,
  },
  permissionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: space._3xl,
    gap: space.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  permissionContent: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: space.xs,
  },
  permissionLabel: {
    fontSize: 18,
  },
  badge: {
    fontSize: 14,
  },
  permissionDesc: {
    fontSize: 15,
    lineHeight: 23,
  },
  bottomPad: {
    paddingHorizontal: space.xl,
    paddingBottom: Platform.OS === "ios" ? 40 : space.xl,
    paddingTop: space.md,
  },
  confirmButton: {
    borderRadius: borderRadius.lg,
    paddingVertical: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    fontSize: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: space._2xl,
  },
  dialog: {
    borderRadius: borderRadius.lg,
    padding: space._2xl,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dialogTitle: {
    fontSize: 24,
    lineHeight: 34,
    marginBottom: space.lg,
  },
  dialogDesc: {
    fontSize: 16,
    lineHeight: 28,
    marginBottom: space._2xl,
  },
  dialogButtons: {
    flexDirection: "row",
    gap: space.md,
  },
  dialogButton: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
});
