import React, { useState } from "react";
import {
  ActivityIndicator,
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

export type Step = "permissions" | "background-location";

interface Props {
  visible: boolean;
  /**
   * Which step to open on. The gate passes `"background-location"` when
   * foreground is already granted but background still needs requesting.
   */
  initialStep?: Step;
  /**
   * Requests foreground location. Resolves to `true` only when granted — the
   * modal advances to the background step exclusively in that case, so we
   * never ask for background before foreground is in hand.
   */
  onRequestForeground: () => Promise<boolean>;
  /** Requests background ("allow all the time") location. */
  onRequestBackground: () => Promise<void> | void;
  /** Driver declined the background step. */
  onSkipBackground: () => void;
}

const PERMISSION_ITEMS = [
  {
    icon: "MapPin" as const,
    label: "Location",
    required: true,
    description:
      "Your location is shared continuously — including when the app is in the background or closed — so you can receive nearby ride requests, let passengers track your journey in real time, and ensure accurate fare calculation.",
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
  initialStep = "permissions",
  onRequestForeground,
  onRequestBackground,
  onSkipBackground,
}: Props) {
  // `initialStep` seeds the first render only. The modal advances itself
  // (foreground → background) via `setStep`, so we never sync props into state
  // here — keeping the component free of effect-driven updates.
  const [step, setStep] = useState<Step>(initialStep);
  const [busy, setBusy] = useState(false);

  const handleForegroundConfirm = async () => {
    if (busy) return; // guard against double taps while the OS prompt is up
    setBusy(true);
    try {
      const granted = await onRequestForeground();
      // Only progress to the background ask once foreground is actually granted.
      if (granted) setStep("background-location");
    } finally {
      setBusy(false);
    }
  };

  const handleBackgroundConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onRequestBackground();
    } finally {
      setBusy(false);
    }
  };

  // NOTE: We intentionally do NOT use React Native's <Modal>. On this app's
  // New Architecture (Fabric) + react-native-gesture-handler setup, mounting an
  // RN Modal spawns a separate native surface that makes gesture-handler try to
  // re-assign a native detector's moduleId, hard-crashing with
  // "Tried to change moduleId of a native detector". The rest of the app renders
  // overlays as absolutely-positioned views for the same reason, so we follow
  // that pattern here: a full-screen, top-most absolute container.
  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="auto">
      {step === "permissions" ? (
        <PermissionsStep onConfirm={handleForegroundConfirm} busy={busy} />
      ) : (
        <BackgroundLocationStep
          onConfirm={handleBackgroundConfirm}
          onCancel={onSkipBackground}
          busy={busy}
        />
      )}
    </View>
  );
}

function PermissionsStep({
  onConfirm,
  busy,
}: {
  onConfirm: () => void;
  busy: boolean;
}) {
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
          disabled={busy}
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor: colors.primary,
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
          onPress={onConfirm}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <RnText
              style={styles.confirmButtonText}
              fontFamily={fontFamily.medium}
              color="#fff"
            >
              Confirm
            </RnText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function BackgroundLocationStep({
  onConfirm,
  onCancel,
  busy = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.overlay}>
      <View style={[styles.dialog, { backgroundColor: colors.background }]}>
        <RnText style={styles.dialogTitle} fontFamily={fontFamily.medium}>
          Background Location{"\n"}Permission Required
        </RnText>

        <RnText style={styles.dialogDesc}>
          To ensure accurate fare calculation and recieve ride request even if
          the app has been closed or stopped, please select &apos;Allow all the
          time&apos; for background location access.
        </RnText>

        <View style={styles.dialogButtons}>
          <Pressable
            disabled={busy}
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: themes.bg_900, opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onCancel}
          >
            <RnText fontFamily={fontFamily.medium}>Cancel</RnText>
          </Pressable>

          <Pressable
            disabled={busy}
            style={({ pressed }) => [
              styles.dialogButton,
              {
                backgroundColor: colors.primary,
                opacity: busy ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
            onPress={onConfirm}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <RnText fontFamily={fontFamily.medium} color="#fff">
                Confirm
              </RnText>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen, top-most overlay container that replaces RN <Modal>. Absolute
  // positioning fills the GestureHandlerRootView; high zIndex/elevation keeps it
  // above the router and any other content.
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
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
