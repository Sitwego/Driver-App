import { useCallback, useEffect, useState, memo } from "react";
import { View, StyleSheet } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  withTiming,
  useAnimatedProps,
  useAnimatedReaction,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

const HANDLE_SIZE = 40;
const TRACK_WIDTH = 120;
const MAX_OFFSET = TRACK_WIDTH - HANDLE_SIZE;
const MID_OFFSET = MAX_OFFSET / 2;

interface GoOnlineSliderProps {
  onStateChange: (isOnline: boolean) => Promise<void>;
  isOnline: boolean;
}

const AnimatedIcon = Animated.createAnimatedComponent(Icon);

const GoOnlineSlider = ({ onStateChange, isOnline }: GoOnlineSliderProps) => {
  const { colors } = useAppTheme();

  const offset = useSharedValue(isOnline ? MAX_OFFSET : 0);
  const onlineOpacity = useSharedValue(isOnline ? 1 : 0);
  const offlineOpacity = useSharedValue(isOnline ? 0 : 1);
  const [showOnlineIcon, setShowOnlineIcon] = useState(isOnline);

  useEffect(() => {
    setShowOnlineIcon(isOnline);
  }, [isOnline]);

  const isOnlineShared = useSharedValue(isOnline);

  // Defined on the JS side so it isn't compiled as a worklet.
  // scheduleOnRN passes goOnline as an arg and calls this on the RN thread.
  const commitStateChange = useCallback(
    (goOnline: boolean) => {
      onStateChange(goOnline).catch(() => {
        isOnlineShared.value = !goOnline;
        setShowOnlineIcon(!goOnline);
      });
    },
    [onStateChange, isOnlineShared],
  );

  useAnimatedReaction(
    () => isOnlineShared.value,
    (online) => {
      offset.value = withSpring(online ? MAX_OFFSET : 0, {
        stiffness: 100,
        damping: 20,
      });
      onlineOpacity.value = withTiming(online ? 1 : 0);
      offlineOpacity.value = withTiming(online ? 0 : 1);
    },
    [],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-5, 5])
    .onChange((event) => {
      offset.value = Math.max(
        0,
        Math.min(MAX_OFFSET, offset.value + event.changeX),
      );
      const progress = offset.value / MAX_OFFSET;
      onlineOpacity.value = progress;
      offlineOpacity.value = 1 - progress;

      // Swap icon at midpoint in both directions
      if (offset.value > MID_OFFSET) {
        scheduleOnRN(setShowOnlineIcon, true);
      } else {
        scheduleOnRN(setShowOnlineIcon, false);
      }
    })
    .onEnd(() => {
      const goOnline = offset.value > MID_OFFSET;
      offset.value = withSpring(
        goOnline ? MAX_OFFSET : 0,
        { stiffness: 100, damping: 20 },
        (finished) => {
          if (finished) {
            isOnlineShared.value = goOnline;
            scheduleOnRN(commitStateChange, goOnline);
          }
        },
      );
      onlineOpacity.value = withTiming(goOnline ? 1 : 0);
      offlineOpacity.value = withTiming(goOnline ? 0 : 1);
      scheduleOnRN(setShowOnlineIcon, goOnline);
    });

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      offset.value,
      [0, MAX_OFFSET],
      ["rgba(239, 202, 116, 0.6)", "#18c78d"],
    ),
  }));

  const onlineTextStyle = useAnimatedStyle(() => ({
    opacity: onlineOpacity.value,
    color: colors.text,
    transform: [{ translateX: -MID_OFFSET - 10 }],
  }));

  const offlineTextStyle = useAnimatedStyle(() => ({
    opacity: offlineOpacity.value,
    color: colors.text,
    transform: [{ translateX: MID_OFFSET + 10 }],
  }));

  // Animated color prop for the icon — drives the SVG stroke color on the UI thread
  const iconColorProps = useAnimatedProps(() => ({
    color: interpolateColor(
      offset.value,
      [0, MAX_OFFSET],
      ["rgb(239, 202, 116)", "#18c78d"],
    ),
  }));

  return (
    <Animated.View
      style={[styles.sliderTrack, trackStyle]}
      onStartShouldSetResponderCapture={() => true}
      onMoveShouldSetResponderCapture={() => true}
    >
      <View style={styles.textContainer}>
        <Animated.Text style={[atoms.text_sm, offlineTextStyle]}>
          Offline
        </Animated.Text>
        <Animated.Text style={[atoms.text_sm, onlineTextStyle]}>
          Online
        </Animated.Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.sliderHandle, handleStyle]}>
          <AnimatedIcon
            animatedProps={iconColorProps}
            name={showOnlineIcon ? "CirclePower" : "PowerOff"}
            size={38}
            strokeWidth={2}
          />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  sliderTrack: {
    width: TRACK_WIDTH,
    height: HANDLE_SIZE,
    borderRadius: 25,
    justifyContent: "center",
    padding: 5,
    overflow: "hidden",
  },
  sliderHandle: {
    justifyContent: "center",
    alignItems: "center",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: "#f8f9ff",
    borderRadius: 20,
    position: "absolute",
  },
  textContainer: {
    position: "absolute",
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
});

export default memo(GoOnlineSlider);
