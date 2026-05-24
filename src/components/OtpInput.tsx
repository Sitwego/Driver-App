import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TextInputKeyPressEventData,
  TextStyle,
  ViewStyle,
} from "react-native";
import { isNumeric } from "~/utils/validations";
import { RnView } from "./RnView";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { atoms } from "~/ui/theme/atoms";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import RnTextInput, { AnimatedTextInputRef } from "./RnTextInput";
import RnText from "./RnText";
import { getValueUsingPixelRatio } from "~/utils/stlyes_metrics";

const inputHeight = getValueUsingPixelRatio(52, 72);

type OtpInputProps = {
  /** Name attribute for the input */
  name?: string;

  /** Input value */
  value?: string;

  /** Should the input auto focus */
  autoFocus?: boolean;

  /** Error text to display */
  errorText?: string;

  /* Should submit when the input is complete */
  shouldSubmitOnComplete?: boolean;

  /** Function to call when the input is changed  */
  onChangeText?: (value: string) => void;

  /** Function to call when the input is submitted or fully complete */
  onFulfill: (value: string) => void;

  /** Specifies if the input has a validation error */
  hasError?: boolean;

  /** Specifies the max length of the input */
  maxLength?: number;

  /** Specifies if the keyboard should be disabled */
  isDisableKeyboard?: boolean;

  /** Last pressed digit on BigDigitPad */
  lastPressedDigit?: string;

  /** TestID for test */
  testID?: string;

  /** Whether to allow auto submit again after the previous attempt fails */
  allowResubmit?: boolean;
};

export type OtpInputMethods = {
  focus: () => void;
  focusLastSelected: () => void;
  resetFocus: () => void;
  clear: () => void;
  blur: () => void;
};

/**
 * Converts a given string into an array of numbers that must have the same
 * number of elements as the number of inputs.
 */
const decomposeString = (value: string, length: number): string[] => {
  let arr = value
    .split("")
    .slice(0, length)
    .map((v) => (isNumeric(v) ? v : " "));
  if (arr.length < length) {
    arr = arr.concat(Array(length - arr.length).fill(" "));
  }
  return arr;
};

/**
 * Converts an array of strings into a single string. If there are undefined or
 * empty values, it will replace them with a space.
 */
const composeToString = (value: string[]): string =>
  value.map((v) => v ?? " ").join("");

const getInputPlaceholderSlots = (length: number): number[] =>
  Array.from(Array(length).keys());

const OtpInput = (
  {
    value = "",
    maxLength = 4,
    onChangeText,
    isDisableKeyboard = false,
    onFulfill,
    shouldSubmitOnComplete = true,
    autoFocus = true,
    lastPressedDigit = "",
  }: OtpInputProps,
  ref: React.Ref<OtpInputMethods>,
) => {
  const { colors, fonts } = useAppTheme();
  const inputRef = useRef<AnimatedTextInputRef | null>(null);
  const [input, setInput] = useState("");
  const [focusedIndex, setFocusedIndex] = useState<number | undefined>(0);
  const editIndex = useRef(0);
  const shouldFocusLast = useRef(false);
  const inputWidth = useRef(0);
  const lastFocusedIndex = useRef(0);
  // FIX: always string — was `string | number` which caused @ts-expect-error below
  const lastValue = useRef<string>("");
  const valueRef = useRef(value);

  useEffect(() => {
    // FIX: store the string itself, not its length (number was making hasToslice always false)
    lastValue.current = input;
  }, [input]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const blurOtpCodeInput = useCallback(() => {
    inputRef.current?.blur();
    setFocusedIndex(undefined);
  }, []);

  const focusOtpCodeInput = useCallback(() => {
    setFocusedIndex(0);
    lastFocusedIndex.current = 0;
    editIndex.current = 0;
    inputRef.current?.focus();
  }, []);

  const setInputAndIndex = useCallback((index: number) => {
    setInput("");
    setFocusedIndex(index);
    editIndex.current = index;
  }, []);

  const validateAndSubmit = useCallback(() => {
    const numbers = decomposeString(value, maxLength);
    if (
      !shouldSubmitOnComplete ||
      numbers.filter((n) => isNumeric(n)).length !== maxLength
    ) {
      return;
    }
    blurOtpCodeInput();
    onFulfill(value);
    lastValue.current = "";
  }, [value, maxLength, shouldSubmitOnComplete, blurOtpCodeInput, onFulfill]);

  // FIX: validateAndSubmit is now stable via useCallback — no stale-closure suppression needed
  useEffect(() => validateAndSubmit(), [validateAndSubmit]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: focusOtpCodeInput,
      focusLastSelected: () => inputRef.current?.focus(),
      resetFocus: () => {
        setInput("");
        focusOtpCodeInput();
      },
      clear: () => {
        lastFocusedIndex.current = 0;
        setInputAndIndex(0);
        inputRef.current?.focus();
        onChangeText?.("");
      },
      blur: blurOtpCodeInput,
    }),
    [focusOtpCodeInput, setInputAndIndex, blurOtpCodeInput, onChangeText],
  );

  // FIX: memoize gesture — was recreated on every render
  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onBegin((e) => {
          const index = Math.floor(e.x / (inputWidth.current / maxLength));
          shouldFocusLast.current = false;
          setFocusedIndex(index);
          lastFocusedIndex.current = index;
        }),
    [maxLength],
  );

  const onFocus = useCallback(
    (event: { preventDefault: () => void }) => {
      if (shouldFocusLast.current) {
        lastValue.current = "";
        setInputAndIndex(lastFocusedIndex.current);
      }
      event.preventDefault();
    },
    [setInputAndIndex],
  );

  const onBlur = useCallback(() => {
    shouldFocusLast.current = true;
    lastFocusedIndex.current = focusedIndex ?? 0;
    setFocusedIndex(undefined);
  }, [focusedIndex]);

  const onInputLayout = useCallback((e: LayoutChangeEvent) => {
    inputWidth.current = e.nativeEvent.layout.width;
  }, []);

  const setInputRef = useCallback((newRef: AnimatedTextInputRef | null) => {
    inputRef.current = newRef;
  }, []);

  const onChangeTextHandler = useCallback(
    (text: string) => {
      // FIX: was `!isNumeric` (always falsy — function reference, not a call)
      if (!text.length || !isNumeric(text)) return;

      const hasToslice =
        text.length - 1 === lastValue.current.length &&
        text.slice(0, text.length - 1) === lastValue.current;
      // FIX: removed @ts-expect-error — lastValue is now always a string
      const newAddedChar = hasToslice
        ? text.slice(lastValue.current.length, text.length)
        : text;
      lastValue.current = text;

      const numbersArr = newAddedChar
        .trim()
        .split("")
        .slice(0, maxLength - editIndex.current);
      const updatedFocusedIndex = Math.min(
        editIndex.current + (numbersArr.length - 1) + 1,
        maxLength - 1,
      );

      let numbers = decomposeString(valueRef.current, maxLength);
      numbers = [
        ...numbers.slice(0, editIndex.current),
        ...numbersArr,
        ...numbers.slice(numbersArr.length + editIndex.current, maxLength),
      ];

      setInputAndIndex(updatedFocusedIndex);

      const finalInput = composeToString(numbers);
      onChangeText?.(finalInput);
      valueRef.current = finalInput;
    },
    // valueRef and editIndex are refs — stable, no need in deps
    [maxLength, setInputAndIndex, onChangeText],
  );

  const onKeyPress = useCallback(
    (event: Partial<NativeSyntheticEvent<TextInputKeyPressEventData>>) => {
      const keyValue = event?.nativeEvent?.key;

      if (keyValue === "Backspace" || keyValue === "<") {
        let numbers = decomposeString(value, maxLength);

        if (isDisableKeyboard && focusedIndex === undefined) {
          const curEditIndex = editIndex.current;
          const indexBeforeLastEditIndex =
            curEditIndex === 0 ? curEditIndex : curEditIndex - 1;
          const indexToFocus =
            numbers.at(curEditIndex) === " "
              ? indexBeforeLastEditIndex
              : curEditIndex;
          if (indexToFocus !== undefined) {
            lastFocusedIndex.current = indexToFocus;
            inputRef.current?.focus();
          }
          onChangeText?.(value.substring(0, indexToFocus));
          return;
        }

        if (focusedIndex !== undefined && numbers?.at(focusedIndex) !== " ") {
          setInput("");
          numbers = [
            ...numbers.slice(0, focusedIndex),
            " ",
            ...numbers.slice(focusedIndex + 1, maxLength),
          ];
          editIndex.current = focusedIndex;
          onChangeText?.(composeToString(numbers));
          return;
        }

        const hasInputs = numbers.filter((n) => isNumeric(n)).length !== 0;

        if (focusedIndex === 0 && !hasInputs) {
          numbers = Array<string>(maxLength).fill(" ");
        } else if (focusedIndex && focusedIndex !== 0) {
          numbers = [
            ...numbers.slice(0, Math.max(0, focusedIndex - 1)),
            " ",
            ...numbers.slice(focusedIndex, maxLength),
          ];
        }

        const newFocusedIndex = Math.max(0, (focusedIndex ?? 0) - 1);
        setInputAndIndex(newFocusedIndex);
        onChangeText?.(composeToString(numbers));
        lastFocusedIndex.current = newFocusedIndex;
        inputRef.current?.focus();
        return;
      }

      if (keyValue === "ArrowLeft" && focusedIndex !== undefined) {
        const newFocusedIndex = Math.max(0, focusedIndex - 1);
        setInputAndIndex(newFocusedIndex);
        inputRef.current?.focus();
      } else if (keyValue === "ArrowRight" && focusedIndex !== undefined) {
        const newFocusedIndex = Math.min(focusedIndex + 1, maxLength - 1);
        setInputAndIndex(newFocusedIndex);
        inputRef.current?.focus();
      } else if (keyValue === "Enter") {
        setInput("");
        onFulfill(value);
      } else if (keyValue === "Tab" && focusedIndex !== undefined) {
        const newFocusedIndex = (event as unknown as KeyboardEvent).shiftKey
          ? focusedIndex - 1
          : focusedIndex + 1;
        if (newFocusedIndex >= 0 && newFocusedIndex < maxLength) {
          setInputAndIndex(newFocusedIndex);
          inputRef.current?.focus();
          if (event?.preventDefault) {
            event.preventDefault();
          }
        }
      }
    },
    [
      value,
      maxLength,
      isDisableKeyboard,
      focusedIndex,
      setInputAndIndex,
      onChangeText,
      onFulfill,
    ],
  );

  // FIX: don't call onChangeTextHandler for backspace — onKeyPress already handles deletion.
  // Calling both caused double-processing (digit was deleted then re-inserted).
  useEffect(() => {
    if (!isDisableKeyboard) return;
    const textValue = lastPressedDigit.charAt(0);
    if (textValue === "<") {
      onKeyPress({ nativeEvent: { key: "<" } });
    } else {
      onKeyPress({ nativeEvent: { key: textValue } });
      onChangeTextHandler(textValue);
    }
    // onKeyPress and onChangeTextHandler intentionally excluded: we only want this
    // to run when the digit pad value changes, not when the callbacks are recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPressedDigit, isDisableKeyboard]);

  // FIX: memoize — decomposeString was called maxLength times per render inside the map
  const digits = useMemo(
    () => decomposeString(value, maxLength),
    [value, maxLength],
  );
  // FIX: memoize — new array was allocated every render
  const slots = useMemo(() => getInputPlaceholderSlots(maxLength), [maxLength]);

  return (
    <RnView style={styles.magicCodeInputContainer}>
      <GestureDetector gesture={tapGesture}>
        <RnView
          style={[
            StyleSheet.absoluteFill,
            atoms.w_full as ViewStyle,
            styles.overlayInput,
          ]}
          collapsable={false}
        >
          <RnTextInput
            onLayout={onInputLayout}
            ref={setInputRef}
            autoFocus={autoFocus}
            returnKeyType="default"
            inputMode="numeric"
            textContentType="oneTimeCode"
            maxLength={maxLength}
            value={input}
            autoComplete="one-time-code"
            keyboardType="numeric"
            onChangeText={onChangeTextHandler}
            onKeyPress={onKeyPress}
            onFocus={onFocus}
            onBlur={onBlur}
            selectionColor="transparent"
            role="presentation"
            style={[styles.hiddenInput, atoms.w_full as TextStyle]}
            testID="otp-input"
          />
        </RnView>
      </GestureDetector>
      {slots.map((index) => (
        <RnView
          key={index}
          style={
            maxLength === 4
              ? [{ width: "10%", marginLeft: 10 }]
              : [{ flex: 1 }, index !== 0 && { marginLeft: 12 }]
          }
        >
          <RnView
            style={[
              styles.slotInner,
              { borderColor: colors.lightBackground },
              { height: inputHeight - 2 },
              focusedIndex === index && styles.slotFocused,
            ]}
          >
            <RnText
              style={[
                styles.magicCodeInput,
                { fontFamily: fonts.heavy.fontFamily },
              ]}
              numberOfLines={1}
            >
              {digits[index] ?? ""}
            </RnText>
          </RnView>
        </RnView>
      ))}
    </RnView>
  );
};

export default React.forwardRef(OtpInput);

const styles = StyleSheet.create({
  magicCodeInputContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: inputHeight,
  },
  // FIX: extracted from inline — was recreated as a new object every render
  overlayInput: {
    backgroundColor: "transparent",
    zIndex: 1000,
  },
  // FIX: extracted from inline — was recreated as a new object every render
  hiddenInput: {
    color: "transparent",
    flex: 1,
    paddingTop: 23,
    paddingBottom: 8,
    paddingLeft: 0,
    borderWidth: 0,
  },
  slotInner: {
    flex: 1,
    justifyContent: "center",
    height: "100%",
    backgroundColor: "transparent",
    overflow: "hidden",
    borderBottomWidth: 2,
  },
  slotFocused: {
    borderColor: "#03D47C",
  },
  magicCodeInput: {
    ...atoms.text_2xl,
    lineHeight: inputHeight + 12,
    zIndex: 999,
    textAlign: "center",
  },
});
