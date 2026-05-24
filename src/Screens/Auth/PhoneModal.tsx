import { PressableScale as Pressable } from "pressto";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { isValidNumber } from "react-native-phone-entry";
import {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import PhoneInputComponet from "~/components/PhoneInput";
import RnText from "~/components/RnText";
import { RnAnimatedView, RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

function getFirebaseAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-phone-number":
      return "The phone number format is invalid. Please check and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment before trying again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded. Please try again later.";
    case "auth/captcha-check-failed":
      return "Verification failed. Please try again.";
    default:
      return "Failed to send verification code. Please try again.";
  }
}

type Props = {
  setPhoneNumber: (phone: string) => Promise<void>;
  isOpen: boolean;
  close: () => void;
};
export const PhoneModal: React.FC<Props> = ({
  setPhoneNumber,
  isOpen,
  close,
}) => {
  const { colors, fonts } = useAppTheme();
  const openAnimValue = useSharedValue(isOpen ? 1 : 0);
  const { top, bottom } = useSafeAreaInsets();
  const [phone, setPhone] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const _isValidPhone = useMemo(() => {
    return Boolean(phone && isValidNumber(phone, "KE"));
  }, [phone]);

  const _onPhoneTextChage = useCallback((phone: string) => {
    setPhone(phone);
    setError(null);
  }, []);

  const _setPhoneNumber = useCallback(async () => {
    if (!phone || !isValidNumber(phone, "KE")) return;
    setLoading(true);
    setError(null);
    try {
      await setPhoneNumber(phone);
      close();
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [phone, setPhoneNumber, close]);

  return (
    <RnAnimatedView animatedProps={drawerContainerProps} style={[modalStyle]}>
      <KeyboardAvoidingView behavior="padding" style={[s.flex1]}>
        {isOpen && (
          <>
            <RnView style={[s.p16]}>
              <RnView style={[s.pt10]}>
                <Pressable onPress={close}>
                  <Icon
                    name="ArrowLeft"
                    size={28}
                    strokeWidth={2.5}
                    color={colors.text}
                  />
                </Pressable>
              </RnView>
              <RnView style={{ marginTop: 24 }} />
              <RnText
                style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
              >
                Enter your mobile number
              </RnText>
              <RnText style={[atoms.text_sm, { opacity: 0.55, marginTop: 6 }]}>
                We&apos;ll send a verification code to this number
              </RnText>
              <RnView style={{ marginTop: 24 }} />
              <PhoneInputComponet
                phone={phone}
                onPhoneTextChange={_onPhoneTextChage}
              />
              {error && (
                <RnText
                  style={[
                    atoms.text_sm,
                    { color: colors.danger, marginTop: 8 },
                  ]}
                >
                  {error}
                </RnText>
              )}
            </RnView>
            <RnView
              style={[s.flex1, s.justifyFlexEnd, { marginBottom: bottom * 2 }]}
            >
              <RnView style={[s.px16]}>
                <Pressable
                  style={[
                    s.p16,
                    s.alignCenter,
                    {
                      borderRadius: 12,
                      backgroundColor:
                        _isValidPhone && !loading
                          ? colors.primary
                          : colors.lightBackground,
                    },
                  ]}
                  onPress={_setPhoneNumber}
                  enabled={_isValidPhone && !loading}
                >
                  {loading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.disabledText}
                    />
                  ) : (
                    <RnText
                      style={{
                        color: _isValidPhone
                          ? colors.text
                          : colors.disabledText,
                      }}
                    >
                      Send Verification Code
                    </RnText>
                  )}
                </Pressable>
              </RnView>
            </RnView>
          </>
        )}
      </KeyboardAvoidingView>
    </RnAnimatedView>
  );
};
