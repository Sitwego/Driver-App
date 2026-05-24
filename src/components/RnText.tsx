import React, { ForwardedRef, forwardRef, useMemo } from "react";
import { Text as RNText, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import type {
  TextProps as RNTextProps,
  StyleProp,
  TextStyle,
} from "react-native";

type TextProps = RNTextProps & {
  /** The color of the text */
  color?: string;

  /** The alignment of the text */
  textAlign?: TextStyle["textAlign"];

  /** Any children to display */
  children: React.ReactNode;

  /**The fontFamily */
  fontFamily?: TextStyle["fontFamily"];
};
function Text(
  {
    color,
    textAlign = "left",
    children,
    style = {},
    fontFamily,
    ...props
  }: TextProps,
  ref: ForwardedRef<RNText>,
) {
  const { colors, fonts } = useAppTheme();

  const _componentStyle: StyleProp<TextStyle> = {
    color: color ?? colors.text,
    fontFamily: fontFamily ?? fonts.medium.fontFamily,
    textAlign,
    ...atoms.text_md,
    ...StyleSheet.flatten(style),
  };

  return (
    <Animated.Text
      allowFontScaling={false}
      ref={ref}
      style={_componentStyle}
      {...props}
    >
      {children}
    </Animated.Text>
  );
}
export default forwardRef(Text);
