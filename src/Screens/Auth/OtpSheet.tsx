import { FirebaseAuthTypes } from "@react-native-firebase/auth";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import RnText from "~/components/RnText";
import RnTextInput, { AnimatedTextInputRef } from "~/components/RnTextInput";
import { RnAnimatedView, RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { useAuthState } from "./LoggedOut";

function getOtpErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-verification-code":
      return "Incorrect code. Please check and try again.";
    case "auth/code-expired":
    case "auth/session-expired":
      return "Code has expired. Please go back and request a new one.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait before trying again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Verification failed. Please try again.";
  }
}
const initialIsModalOpened = false;
interface Props {
  children: React.ReactNode | React.ReactElement;
}
export interface OTPConfirmationRef {
  show_otp_modal: (props: FirebaseAuthTypes.ConfirmationResult) => void;
  hide_otp_modal: () => void;
  // verify_otp_code: (code: string) => Promise<void>;
}
export const OtpSheet = React.forwardRef<OTPConfirmationRef, Props>(
  ({ children }, ref) => {
    const { colors, fonts } = useAppTheme();
    const { authState, setAuthState } = useAuthState();
    const [isOpen, setIsOpen] = React.useState<boolean>(initialIsModalOpened);
    const openAnimValue = useSharedValue(isOpen ? 1 : 0);
    const { top, bottom } = useSafeAreaInsets();
    const [confirmationResult, setConfirmationResult] = useState<
      FirebaseAuthTypes.ConfirmationResult | undefined
    >(undefined);
    const [otp, setOtp] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const otpInputRef = React.useRef<AnimatedTextInputRef>(null);

    useEffect(() => {
      otpInputRef.current?.focus();
    }, []);

    const isModalOpened = useCallback(() => {
      return openAnimValue.value === 1;
    }, [openAnimValue.value]);
    useImperativeHandle(
      ref,
      () => ({
        show_otp_modal: (props: FirebaseAuthTypes.ConfirmationResult) => {
          if (!isModalOpened()) {
            setConfirmationResult(props);
            setOtp("");
            setError(null);
            setIsOpen(true);
          }
        },
        hide_otp_modal: () => {
          if (isModalOpened()) {
            setConfirmationResult(undefined);
            setIsOpen(false);
          }
        },
      }),
      [isModalOpened],
    );

    React.useEffect(() => {
      openAnimValue.value = withTiming(isOpen ? 1 : 0, { duration: 300 });
    }, [isOpen, openAnimValue]);

    const drawerContainerProps = useAnimatedProps(() => ({
      pointerEvents:
        openAnimValue.value === 1 ? ("auto" as const) : ("none" as const),
    }));

    const modalStyle = useAnimatedStyle(() => ({
      height: `${interpolate(openAnimValue.value, [0, 1], [0, 100])}%`,
      transform: [
        {
          translateY: interpolate(openAnimValue.value, [0, 1], [90, 0]),
        },
      ],
      position: "absolute",
      display: "flex",
      top: top,
      bottom: bottom,
      left: 0,
      right: 0,
      backgroundColor: colors.background,
    }));

    const _verifyOtpCode = useCallback(async () => {
      if (!confirmationResult) return;
      setLoading(true);
      setError(null);
      try {
        const userCredential = await confirmationResult.confirm(otp);
        if (userCredential?.user?.phoneNumber) {
          setAuthState((prev) => ({
            ...prev,
            phone_number: userCredential.user.phoneNumber as string,
            isVerified_phone_number: true,
          }));
        }
        setIsOpen(false);
      } catch (err) {
        setError(getOtpErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, [confirmationResult, otp, setAuthState]);

    const onChange = useCallback((text: string) => {
      setOtp(text);
      setError(null);
    }, []);

    const valideOTP = useMemo(() => {
      if (!otp) return false;
      if (!/^\d+$/.test(otp)) return false;
      if (otp.length < 4 || otp.length > 6) return false;
      return true;
    }, [otp]);

    return (
      <>
        {children}
        {isOpen && (
          <RnAnimatedView
            animatedProps={drawerContainerProps}
            style={[modalStyle, {}]}
          >
            <KeyboardAvoidingView behavior="padding" style={[s.flex1]}>
              <RnView style={[s.mt20, s.px16]}>
                <RnText
                  style={[
                    atoms.text_xl,
                    { fontFamily: fonts.heavy.fontFamily },
                  ]}
                >
                  Verify your number
                </RnText>
                <RnText
                  style={[
                    atoms.text_sm,
                    {
                      opacity: 0.55,
                      marginTop: 6,
                      fontFamily: fonts.regular.fontFamily,
                    },
                  ]}
                >
                  {authState.phone_number
                    ? `Code sent to ${authState.phone_number}`
                    : "Enter the code we sent to your phone"}
                </RnText>
              </RnView>
              <RnView style={[s.flex1, s.px16, s.mt20]}>
                <RnTextInput
                  ref={otpInputRef}
                  style={[
                    s.input,
                    s.f16,
                    s.w100pct,
                    {
                      fontFamily: fonts.regular.fontFamily,
                      color: colors.text,
                      borderColor: error ? colors.danger : colors.background,
                    },
                  ]}
                  autoFocus
                  underlineColorAndroid={
                    error ? colors.danger : colors.background
                  }
                  keyboardType="number-pad"
                  autoCorrect={false}
                  cursorColor={colors.text}
                  maxLength={6}
                  inputMode="numeric"
                  onChangeText={onChange}
                  // onBlur={onBlur}
                  placeholder="Enter OTP"
                  placeholderTextColor={colors.lightGray}
                  value={otp}
                />
                {error ? (
                  <RnText
                    style={[
                      atoms.text_sm,
                      { color: colors.danger, marginTop: 6 },
                    ]}
                  >
                    {error}
                  </RnText>
                ) : (
                  <RnView style={[s.mt10]}>
                    <RnText
                      style={[
                        atoms.text_sm,
                        {
                          color: colors.text,
                          fontFamily: fonts.regular.fontFamily,
                        },
                      ]}
                    >
                      Didn&apos;t receive the code? Resend
                    </RnText>
                  </RnView>
                )}
              </RnView>
              <RnView
                style={[
                  s.flex1,
                  s.justifyFlexEnd,
                  { marginBottom: bottom * 2 },
                ]}
              >
                <RnView
                  style={[
                    s.flexDirectionRow,
                    s.justifyCenter,
                    s.gap16,
                    { flexWrap: "wrap" },
                  ]}
                >
                  <PressableWithFeedBack
                    wrapperStyle={[
                      s.p16,
                      s.alignCenter,
                      {
                        borderRadius: 8,
                        width: "90%",
                        backgroundColor:
                          valideOTP && !loading
                            ? colors.primary
                            : colors.disabled_bg,
                      },
                    ]}
                    onPress={_verifyOtpCode}
                    disabled={!valideOTP || loading}
                  >
                    {loading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.disabledText}
                      />
                    ) : (
                      <RnText
                        style={[
                          {
                            color: valideOTP
                              ? colors.text
                              : colors.disabledText,
                          },
                        ]}
                      >
                        Verify
                      </RnText>
                    )}
                  </PressableWithFeedBack>
                </RnView>
              </RnView>
            </KeyboardAvoidingView>
          </RnAnimatedView>
        )}
      </>
    );
  },
);

OtpSheet.displayName = "OtpSheet";
