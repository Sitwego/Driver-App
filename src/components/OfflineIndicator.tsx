import React, { useEffect } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import useNetwork from "~/hooks/useNetwork";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import Icon from "./Icons";
import RnText from "./RnText";

const FADE_DURATION = 250;
/** Delay before showing so brief blips don't flash the modal */
const SHOW_DELAY = 800;

/**
 * Full-screen blocking modal shown when the device has no internet.
 * Uses RN's `<Modal>` so it sits above the entire native view hierarchy —
 * no touch event can reach the app behind it.
 *
 * Mount once inside the root layout:
 * ```tsx
 * <OfflineIndicator />
 * ```
 */
export function OfflineIndicator() {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const { colors, fonts } = useAppTheme();

  useEffect(() => {
    if (isOffline) {
      opacity.value = withDelay(
        SHOW_DELAY,
        withTiming(1, { duration: FADE_DURATION }),
      );
    } else {
      opacity.value = withTiming(0, { duration: FADE_DURATION });
    }
  }, [isOffline, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Modal
      visible={isOffline}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
    >
      <Animated.View style={[styles.overlay, animatedStyle]}>
        <View style={[styles.iconWrap, { marginTop: insets.top + 24 }]}>
          <Icon
            name="WifiOff"
            size={48}
            color={themes.red_400}
            strokeWidth={1.5}
          />
        </View>

        <View style={styles.card}>
          <RnText
            style={[
              atoms.text_xl,
              { fontFamily: fonts.heavy.fontFamily, color: themes.red_400 },
            ]}
          >
            You&apos;re offline
          </RnText>
          <RnText style={styles.body}>
            Please check your internet connection.{"\n"}
            The app will resume automatically once you&apos;re back online.
          </RnText>

          <View style={styles.dotRow}>
            {[0, 1, 2].map((i) => (
              <PulsingDot key={i} delay={i * 200} />
            ))}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Pulsing dot — visual cue that we're still listening ─────────────────────

function PulsingDot({ delay }: { delay: number }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.6, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1, // infinite
        false,
      ),
    );
  }, [delay, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value > 1 ? 0.9 : 0.35,
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: themes.red_950,
    borderWidth: 1,
    borderColor: themes.red_800,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  card: {
    width: "100%",
    backgroundColor: themes.bg_950,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themes.red_900,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
  },
  title: {
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    color: themes.bg_300,
    textAlign: "center",
    lineHeight: 22,
  },
  dotRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: themes.red_400,
  },
});
