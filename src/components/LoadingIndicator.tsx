import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

type LoadingIndicatorProps = {
  /** Number of dots to render
   * @default 3
   */
  dotCount?: number;

  /** Diameter of each dot in pixels
   * @default 10
   */
  dotSize?: number;

  /** Gap between dots in pixels
   * @default 8
   */
  gap?: number;

  /** Override the dot color; defaults to the theme primary color */
  color?: string;

  /** How high each dot bounces (translateY) in pixels
   * @default 8
   */
  bounceHeight?: number;

  /** Duration of one full bounce cycle in milliseconds
   * @default 600
   */
  duration?: number;
};

const DOT_DELAY = 150;

function Dot({
  color,
  size,
  delay,
  bounceHeight,
  duration,
}: {
  color: string;
  size: number;
  delay: number;
  bounceHeight: number;
  duration: number;
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-bounceHeight, {
            duration: duration / 2,
            easing: Easing.out(Easing.quad),
          }),
          withTiming(0, {
            duration: duration / 2,
            easing: Easing.in(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [translateY, delay, bounceHeight, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}

export default function LoadingIndicator({
  dotCount = 3,
  dotSize = 10,
  gap = 8,
  color,
  bounceHeight = 8,
  duration = 600,
}: LoadingIndicatorProps) {
  const { colors } = useAppTheme();
  const dotColor = color ?? colors.primary;

  return (
    <View style={[styles.container, { gap }]}>
      {Array.from({ length: dotCount }).map((_, i) => (
        <Dot
          key={i}
          color={dotColor}
          size={dotSize}
          delay={i * DOT_DELAY}
          bounceHeight={bounceHeight}
          duration={duration}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
});
