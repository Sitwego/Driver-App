import React, { forwardRef, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { borderRadius, space } from "~/ui/theme/tokens";

import type { BottomSheetOptions } from "./types";

/**
 * Background view passed to the library `surface` prop. The library requires
 * it to fill the sheet, hence absoluteFill.
 */
export const SheetSurfaceBackground = ({
  backgroundColor,
  borderTopRadius,
}: {
  backgroundColor?: string;
  borderTopRadius?: number;
}) => {
  const { colors } = useAppTheme();
  const radius = borderTopRadius ?? borderRadius.lg;
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: backgroundColor ?? colors.background,
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
          overflow: "hidden",
        },
      ]}
    />
  );
};

/**
 * Content wrapper shared by every sheet: drag handle (the library has none),
 * safe-area padding, and optional keyboard avoidance.
 */
// A content-only sheet must shrink-wrap to its children so the library's
// "content" detent can measure a natural height; flex:1 here would make it
// claim the full available height instead. Any fixed/large detent means the
// sheet has a definite height to fill, so the content should stretch to it
// (the library's own guidance: "for a full-height sheet apply flex: 1 to the
// content").
const wantsBoundedHeight = (options: BottomSheetOptions): boolean => {
  const detents = options.detents ?? ["content"];
  return detents.some((d) => d !== "content");
};

export const SheetSurfaceContent = forwardRef<
  View,
  { options: BottomSheetOptions; children: ReactNode }
>(({ options, children }, ref) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { surface, safeArea, keyboard } = options;
  const expand = wantsBoundedHeight(options) ? styles.expand : undefined;
  const basePaddingBottom = (safeArea?.bottom ?? true) ? insets.bottom : 0;
  const paddingTop = safeArea?.top ? insets.top : 0;

  // Hooks run unconditionally (rules of hooks); the animated style is only
  // applied when keyboard === "avoid". Matches the library's own recipe
  // (docs "Keyboard handling"): drive the content's bottom padding directly
  // off the live keyboard height instead of KeyboardAvoidingView, which
  // fights the sheet's own content-height measurement.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const keyboardPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(
      basePaddingBottom,
      Math.max(0, -keyboardHeight.value),
    ),
  }));

  const handle = (surface?.showHandle ?? true) && (
    <View style={styles.handleZone}>
      <View style={[styles.handle, { backgroundColor: colors.lightGray }]} />
    </View>
  );

  const content =
    keyboard === "avoid" ? (
      <Animated.View
        style={[
          styles.content,
          expand,
          { paddingTop },
          keyboardPaddingStyle,
          surface?.contentContainerStyle,
        ]}
      >
        {children}
      </Animated.View>
    ) : (
      <View
        style={[
          styles.content,
          expand,
          { paddingTop, paddingBottom: basePaddingBottom },
          surface?.contentContainerStyle,
        ]}
      >
        {children}
      </View>
    );

  return (
    <View
      ref={ref}
      style={[styles.root, expand]}
      accessible={false}
      accessibilityViewIsModal
      accessibilityLabel={options.accessibilityLabel}
      testID={options.testID}
      accessibilityLiveRegion="polite"
    >
      {handle}
      {content}
    </View>
  );
});
SheetSurfaceContent.displayName = "SheetSurfaceContent";

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  expand: {
    flex: 1,
  },
  handleZone: {
    alignItems: "center",
    paddingVertical: space.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: borderRadius.full,
    opacity: 0.5,
  },
  content: {
    width: "100%",
  },
});
