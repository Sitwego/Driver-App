import type { ForwardedRef } from "react";
import React from "react";
import type { TextInputProps } from "react-native";
import { TextInput } from "react-native";
import Animated from "react-native-reanimated";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

// Convert the underlying TextInput into an Animated component so that we can take an animated ref and pass it to a worklet
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type AnimatedTextInputRef = typeof AnimatedTextInput &
  TextInput &
  HTMLInputElement;

function RNTextInputWithRef(
  props: TextInputProps,
  ref: ForwardedRef<AnimatedTextInputRef>,
) {
  const theme = useAppTheme();

  return (
    <AnimatedTextInput
      allowFontScaling={false}
      textBreakStrategy="simple"
      keyboardAppearance={theme.themeMode === "dark" ? "dark" : "light"}
      ref={(refHandle) => {
        if (typeof ref !== "function") {
          return;
        }
        ref(refHandle as AnimatedTextInputRef);
      }}
      // eslint-disable-next-line
        {...props}
    />
  );
}

RNTextInputWithRef.displayName = "RNTextInputWithRef";

export default React.forwardRef(RNTextInputWithRef);
export type { AnimatedTextInputRef };
