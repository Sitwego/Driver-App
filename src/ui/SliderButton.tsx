import React from "react";
import {
  StyleSheet,
  Dimensions,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  ReduceMotion,
  Easing,
  interpolateColor,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { RnView } from "~/components/RnView";
import { useAppTheme } from "./theme/ThemeProvider";
import { atoms } from "./theme/atoms";

const { width: screenWidth } = Dimensions.get("window");
const SLIDER_TRACK_WIDTH = screenWidth * 0.8;
const SLIDER_SIZE = 50;
const TRACK_HEIGHT = SLIDER_SIZE + 10;
const BORDER_RADIUS = 16;
const SLIDER_INITIAL_LEFT = 0;
export const SPRING_CONFIG = {
  damping: 20,
  stiffness: 240,
  mass: 0.4,
};

type SwipeSliderProps = {
  onSwipeComplete: (bool?: boolean) => void;
  enableHaptics?: boolean;
  sliderSize?: number;
  sliderTrackWidth?: number;
  sliderTrackHeight?: number;
  borderRadius?: number;
  initialTrackColor: string;
  completeTrackColor: string;
  sliderBackgroundColor: string;
  textColor: string;
  initialText: string;
  completeText: string;
  startIcon: React.ReactElement;
  endIcon: React.ReactElement;
  trackStyle?: StyleProp<ViewStyle>;
  handleStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  reduceMotion?: "never" | "always" | "system";
};

const SwipeSlider: React.FC<SwipeSliderProps> = ({
  onSwipeComplete,
  enableHaptics = true,
  sliderSize = SLIDER_SIZE,
  sliderTrackWidth = SLIDER_TRACK_WIDTH,
  sliderTrackHeight = TRACK_HEIGHT,
  borderRadius = BORDER_RADIUS,
  initialTrackColor,
  completeTrackColor,
  sliderBackgroundColor,
  textColor,
  initialText,
  completeText,
  startIcon,
  endIcon,
  textStyle,
  reduceMotion = "system",
}) => {
  const offset = useSharedValue(0);
  const { fonts } = useAppTheme();
  const completionProgress = useSharedValue(0);
  const MaxOffset = sliderTrackWidth - sliderSize - SLIDER_INITIAL_LEFT;

  const motion =
    reduceMotion === "never"
      ? ReduceMotion.Never
      : reduceMotion === "always"
        ? ReduceMotion.Always
        : ReduceMotion.System;

  const TIMING_CONFIG = {
    duration: 350,
    easing: Easing.in(Easing.linear),
    reduceMotion: motion,
  };
  const handleHaptic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const isCompleting = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-5, 5])
    .onChange((event) => {
      if (isCompleting.value === 0) {
        const newOffset = offset.value + event.changeX;
        offset.value = Math.max(0, Math.min(newOffset, MaxOffset));
      }
    })
    .onEnd(() => {
      if (isCompleting.value === 0) {
        const halfwayPoint = MaxOffset * 0.4;
        if (offset.value >= halfwayPoint) {
          isCompleting.value = 1;
          completionProgress.value = withTiming(
            1,
            TIMING_CONFIG,
            (finished) => {
              if (finished) {
                runOnJS(onSwipeComplete)(finished);
                enableHaptics && runOnJS(handleHaptic)();
                isCompleting.value = 0; // Reset after completion
              }
            },
          );
          offset.value = withTiming(MaxOffset, TIMING_CONFIG);
        } else {
          completionProgress.value = withTiming(0, TIMING_CONFIG);
          offset.value = withTiming(0, TIMING_CONFIG);
        }
      }
    });
  const sliderHandleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: offset.value }],
    };
  });

  const sliderTrackAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        offset.value,
        [0, MaxOffset],
        [initialTrackColor, completeTrackColor],
      ),
      zIndex: 1,
    };
  });

  const slideToPayTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        completionProgress.value,
        [0, 0.5], // Fade out as completionProgress goes from 0 to 0.5
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  // Animated style for "Success!" text
  const successTextAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        completionProgress.value,
        [0.5, 1], // Fade in as completionProgress goes from 0.5 to 1
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <Animated.View
      style={[
        styles.sliderTrack,
        sliderTrackAnimatedStyle,
        {
          width: sliderTrackWidth,
          height: sliderTrackHeight,
          borderRadius: borderRadius,
        },
      ]}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.sliderHandle,
            sliderHandleStyle,
            {
              backgroundColor: sliderBackgroundColor,
              width: sliderSize,
              height: sliderSize,
              borderRadius: borderRadius,
            },
          ]}
        >
          <Animated.View
            style={[slideToPayTextAnimatedStyle, styles.iconContainer]}
          >
            {startIcon}
          </Animated.View>
          <Animated.View
            style={[successTextAnimatedStyle, styles.iconContainer]}
          >
            {endIcon}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
      <RnView style={styles.textContainer} pointerEvents="none">
        <Animated.Text
          style={[
            styles.sliderTextBase,
            { color: textColor, fontFamily: fonts.medium.fontFamily },
            slideToPayTextAnimatedStyle,
            textStyle,
          ]}
        >
          {initialText}
        </Animated.Text>
        <Animated.Text
          style={[
            styles.sliderTextBase,
            { color: textColor, fontFamily: fonts.medium.fontFamily },
            successTextAnimatedStyle,
            textStyle,
          ]}
        >
          {completeText}
        </Animated.Text>
      </RnView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sliderTrack: {
    justifyContent: "center",
    alignItems: "center",
  },
  sliderHandle: {
    position: "absolute",
    left: SLIDER_INITIAL_LEFT,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  iconContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject, // Makes this view fill its parent (sliderTrack)
    justifyContent: "center",
    alignItems: "center",
    // No zIndex needed here, or zIndex: 0, to be behind the handle
  },
  sliderTextBase: {
    // Base style for both texts
    ...atoms.text_lg,
    fontWeight: "500",
    position: "absolute", // Critical for texts to overlap for the cross-fade effect
  },
});

export default SwipeSlider;
