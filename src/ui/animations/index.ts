import { Easing } from "react-native-reanimated";

export const ACTION_SHEET_ANIMATION_DURATION = 250;
export const ANIMATION_CONFIG = {
  duration: ACTION_SHEET_ANIMATION_DURATION,
  // https://easings.net/#easeInOutCubic
  easing: Easing.bezier(0.645, 0.045, 0.355, 1.0),
};
