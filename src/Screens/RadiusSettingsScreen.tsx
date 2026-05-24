import { Dimensions, StyleSheet, View } from "react-native";
import {
  ScrollView,
  GestureDetector,
  Gesture,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  interpolate,
  Extrapolation,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import Icon from "~/components/Icons";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { NavigationProps } from "~/navigation/types";
import { themes } from "~/ui/theme/theme_utils";
import { useCallback, useState } from "react";
import { useDriverSettings } from "~/lib/Providers/DriverSettingsProvider";
import { PressableScale } from "pressto";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PADDING_H = 16;
const TRACK_WIDTH = SCREEN_WIDTH - PADDING_H * 2;
const THUMB_SIZE = 30;
const TRACK_HEIGHT = 6;
const MAX_OFFSET = TRACK_WIDTH - THUMB_SIZE;

const MIN_RADIUS = 0.5;
const MAX_RADIUS = 8;

function offsetToRadius(offset: number): number {
  "worklet";
  return MIN_RADIUS + (offset / MAX_OFFSET) * (MAX_RADIUS - MIN_RADIUS);
}

function radiusToOffset(radius: number): number {
  "worklet";
  return ((radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)) * MAX_OFFSET;
}

function formatRadius(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const SNAP_LABELS = [0.5, 2, 4, 6, 8];

export function RadiusSettingsScreen({
  navigation,
}: NavigationProps<"RadiusSettingsScreen">) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { radius: savedRadius, setRadius } = useDriverSettings();

  const position = useSharedValue(radiusToOffset(savedRadius));
  const [displayRadius, setDisplayRadius] = useState(savedRadius);
  const lastHapticKm = useSharedValue(savedRadius);

  const updateRadius = useCallback((km: number) => {
    setDisplayRadius(km);
  }, []);

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const pan = Gesture.Pan()
    .onChange((e) => {
      const next = Math.max(
        0,
        Math.min(position.value + e.changeX, MAX_OFFSET),
      );
      position.value = next;
      const km = parseFloat(offsetToRadius(next).toFixed(1));
      // haptic every ~0.5km snap
      if (Math.abs(km - lastHapticKm.value) >= 0.5) {
        lastHapticKm.value = km;
        runOnJS(triggerHaptic)();
      }
      runOnJS(updateRadius)(parseFloat(offsetToRadius(next).toFixed(1)));
    })
    .onEnd(() => {
      // Snap to nearest 0.5km
      const km = offsetToRadius(position.value);
      const snapped = Math.round(km * 2) / 2;
      const clipped = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, snapped));
      position.value = withTiming(radiusToOffset(clipped), { duration: 150 });
      runOnJS(updateRadius)(clipped);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: position.value + THUMB_SIZE / 2,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      position.value,
      [0, MAX_OFFSET],
      [0.3, 1],
      Extrapolation.CLAMP,
    ),
    width: position.value + THUMB_SIZE / 2,
  }));

  return (
    <ScrollView
      scrollEnabled={false}
      contentContainerStyle={[
        s.px16,
        s.py16,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* Header */}
      <RnView style={[s.flexDirectionRow, s.alignCenter, s.gap12, s.mb32]}>
        <RnView
          style={[
            s.alignCenter,
            s.justifyCenter,
            {
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: colors.lightBackground,
            },
          ]}
        >
          <Icon
            name="Radius"
            size={24}
            color={colors.primary}
            strokeWidth={1.5}
          />
        </RnView>
        <RnView>
          <RnText
            style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
          >
            Pickup Radius
          </RnText>
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            Only receive requests within this range
          </RnText>
        </RnView>
      </RnView>

      {/* Big radius display */}
      <RnView style={[s.alignCenter, s.mb32]}>
        <RnText
          style={[
            {
              fontSize: 56,
              fontFamily: fonts.heavy.fontFamily,
              color: colors.primary,
              lineHeight: 64,
            },
          ]}
        >
          {displayRadius < 1
            ? `${Math.round(displayRadius * 1000)}`
            : displayRadius.toFixed(1)}
        </RnText>
        <RnText
          style={[
            atoms.text_md,
            {
              color: colors.lightGray,
              fontFamily: fonts.bold.fontFamily,
              marginTop: -4,
            },
          ]}
        >
          {displayRadius < 1 ? "metres" : "kilometres"}
        </RnText>
      </RnView>

      {/* Slider track */}
      <RnView style={[{ paddingHorizontal: 0, marginBottom: 32 }]}>
        <View
          style={[styles.trackContainer, { backgroundColor: themes.bg_800 }]}
        >
          {/* Glow layer */}
          <Animated.View
            style={[
              styles.fill,
              glowStyle,
              {
                backgroundColor: colors.primary,
                opacity: 0.25,
                height: TRACK_HEIGHT + 6,
                top: -3,
                borderRadius: 6,
              },
            ]}
          />
          {/* Fill */}
          <Animated.View
            style={[
              styles.fill,
              fillStyle,
              { backgroundColor: colors.primary },
            ]}
          />
          {/* Thumb */}
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                styles.thumb,
                thumbStyle,
                {
                  backgroundColor: "#fff",
                  borderColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
            />
          </GestureDetector>
        </View>

        {/* Snap labels */}
        <RnView
          style={[s.flexDirectionRow, s.justifyBetween, { marginTop: 10 }]}
        >
          {SNAP_LABELS.map((km) => (
            <RnText
              key={km}
              style={[
                atoms.text_xs,
                {
                  color:
                    Math.abs(displayRadius - km) < 0.3
                      ? colors.primary
                      : colors.lightGray,
                  fontFamily:
                    Math.abs(displayRadius - km) < 0.3
                      ? fonts.bold.fontFamily
                      : fonts.regular.fontFamily,
                },
              ]}
            >
              {formatRadius(km)}
            </RnText>
          ))}
        </RnView>
      </RnView>

      {/* Info card */}
      <RnView
        style={[
          s.px16,
          s.py12,
          s.borderRadius_sm,
          s.mt8,
          s.flexDirectionRow,
          s.gap8,
          s.alignCenter,
          {
            backgroundColor: themes.bg_900,
            borderLeftWidth: 3,
            borderLeftColor: colors.primary,
          },
        ]}
      >
        <Icon
          name="Info"
          size={16}
          color={colors.lightGray}
          strokeWidth={1.5}
        />
        <RnText
          style={[atoms.text_xs, { color: colors.lightGray, flexShrink: 1 }]}
        >
          A larger radius means more requests but longer pickup distances.
        </RnText>
      </RnView>

      {/* Save button */}
      <PressableScale
        style={[
          s.alignCenter,
          s.p16,
          s.borderRadius_sm,
          s.mt24,
          { backgroundColor: colors.primary },
        ]}
        onPress={() => {
          setRadius(displayRadius);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        }}
      >
        <RnText
          style={[
            atoms.text_sm,
            { fontFamily: fonts.heavy.fontFamily, color: "#fff" },
          ]}
        >
          Save — {formatRadius(displayRadius)}
        </RnText>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  trackContainer: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
    overflow: "visible",
  },
  fill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
    top: -(THUMB_SIZE - TRACK_HEIGHT) / 2,
  },
});
