import React from "react";
import type { TextInputProps, TextProps as RNTextProps } from "react-native";
import { StyleSheet, TextInput } from "react-native";
// import Animated, {
//   AnimateProps,
//   SharedValue,
//   useAnimatedProps,
// } from "react-native-reanimated";

// const styles = StyleSheet.create({
//   baseStyle: {
//     color: "black",
//   },
// });
// Animated.addWhitelistedNativeProps({ text: true });

// interface TextProps extends Omit<TextInputProps, "value" | "style"> {
//   text: SharedValue<string>;
//   style?: AnimateProps<RNTextProps>["style"];
// }

// const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// const ReText = (props: TextProps) => {
//   const { style, text, ...rest } = props;
//   const animatedProps = useAnimatedProps(() => {
//     return {
//       text: text.value,
//       // Here we use any because the text prop is not available in the type
//     } as any;
//   });
//   return (
//     <AnimatedTextInput
//       underlineColorAndroid="transparent"
//       editable={false}
//       value={text.value}
//       style={[styles.baseStyle, style || undefined]}
//       {...rest}
//       {...{ animatedProps }}
//     />
//   );
// };

// export default ReText;
import Animated, {
  AnimateProps,
  SharedValue,
  useAnimatedProps,
} from "react-native-reanimated";

const styles = StyleSheet.create({
  baseStyle: {
    color: "black",
  },
});

Animated.addWhitelistedNativeProps({ text: true });

interface TextProps extends Omit<TextInputProps, "value" | "style"> {
  text: SharedValue<string>;
  style?: AnimateProps<RNTextProps>["style"];
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const ReText = (props: TextProps) => {
  const { style, text, ...rest } = props;
  const animatedProps = useAnimatedProps(() => {
    return {
      text: text.value, // Bind text value in worklet
    } as any;
  });

  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      style={[styles.baseStyle, style || undefined]}
      {...rest}
      animatedProps={animatedProps} // Use animatedProps for text updates
    />
  );
};

export default ReText;
