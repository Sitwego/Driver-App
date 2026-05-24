import { Color } from "@shopify/react-native-skia";
import React, { useState } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import { AnimatedStyle } from "react-native-reanimated";
import OpacityView from "../OpercityView";

type PressableWithFeedbackProps = PressableProps & {
  /** Style for the wrapper view */
  wrapperStyle?: StyleProp<AnimatedStyle<ViewStyle>>;

  /**
   * Determines what opacity value should be applied to the underlying view when Pressable is pressed.
   * To disable dimming, pass 1 as pressDimmingValue
   * @default variables.pressDimValue
   */
  pressDimmingValue?: number;

  /**
   * Determines what opacity value should be applied to the underlying view when pressable is hovered.
   * To disable dimming, pass 1 as hoverDimmingValue
   * @default variables.hoverDimValue
   */
  hoverDimmingValue?: number;

  /**
   * The duration of the dimming animation
   * @default variables.dimAnimationDuration
   */
  dimAnimationDuration?: number;

  /** Whether the view needs to be rendered offscreen (for Android only) */
  needsOffscreenAlphaCompositing?: boolean;

  /** The color of the underlay that will show through when the Pressable is active. */
  underlayColor?: Color;

  /**
   * Whether the button should have a background layer in the color of theme.appBG.
   * This is needed for buttons that allow content to display under them.
   */
  shouldBlendOpacity?: boolean;
};

function PressableWithFeedback(
  {
    children,
    wrapperStyle = [],
    needsOffscreenAlphaCompositing = false,
    pressDimmingValue = 0.8,
    hoverDimmingValue = 1,
    dimAnimationDuration,
    shouldBlendOpacity,
    ...rest
  }: PressableWithFeedbackProps,
  ref: any,
) {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  return (
    <OpacityView
      shouldDim={
        !shouldBlendOpacity && !!(!rest.disabled && (isPressed || isHovered))
      }
      dimmingValue={isPressed ? pressDimmingValue : hoverDimmingValue}
      dimAnimationDuration={dimAnimationDuration}
      style={wrapperStyle}
      needsOffscreenAlphaCompositing={needsOffscreenAlphaCompositing}
    >
      <Pressable
        disabled={rest.disabled}
        onHoverIn={(event) => {
          setIsHovered(true);
          if (rest.onHoverIn) {
            rest.onHoverIn(event);
          }
        }}
        onHoverOut={(event) => {
          setIsHovered(false);
          if (rest.onHoverOut) {
            rest.onHoverOut(event);
          }
        }}
        onPressIn={(event) => {
          setIsPressed(true);
          if (rest.onPressIn) {
            rest.onPressIn(event);
          }
        }}
        onPressOut={(event) => {
          setIsPressed(false);
          if (rest.onPressOut) {
            rest.onPressOut(event);
          }
        }}
        {...rest}
        ref={ref}
      >
        {(state) =>
          typeof children === "function" ? children(state) : children
        }
      </Pressable>
    </OpacityView>
  );
}

export default React.forwardRef(PressableWithFeedback);
