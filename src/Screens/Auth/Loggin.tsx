import { PressableScale as Pressable } from "pressto";
import React, { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import RnText from "~/components/RnText";
import RnTextInput, { AnimatedTextInputRef } from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import { useUserApi } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import { AuthScreenState } from "./AuthScreenType";
import { useAuthState } from "./LoggedOut";

type LoginForm = {
  password: string;
};

function getLoginErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const message = (err as { message?: unknown })?.message;
  if (status === 401) return "Incorrect password. Please try again.";
  if (status === 404) return "No account found for this phone number.";
  if (status === 429)
    return "Too many attempts. Please wait before trying again.";
  if (typeof message === "string" && message.length > 0 && message.length < 120)
    return message;
  return "Login failed. Please check your connection and try again.";
}

interface Props {
  setScreen: (prop?: AuthScreenState) => void;
}
export const LogInScreen: React.FC<Props> = ({ setScreen }) => {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();
  const { authState } = useAuthState();
  const { login } = useUserApi();

  const inputRef = React.useRef<AnimatedTextInputRef>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: { password: "" },
    mode: "onChange",
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const _login = handleSubmit(async ({ password }) => {
    try {
      await login({
        phone_number: authState.phone_number!,
        password,
        device_id: "some-device-id",
      });
    } catch (err) {
      setError("root", { message: getLoginErrorMessage(err) });
    }
  });

  return (
    <RnView style={{ flex: 1, paddingTop: insets.top + 16 }}>
      <RnView style={[s.px16, s.mb20]}>
        <Pressable
          onPress={() => setScreen(undefined)}
          style={{ alignSelf: "flex-start", marginBottom: 24 }}
        >
          <Icon
            name="ArrowLeft"
            size={28}
            strokeWidth={2.5}
            color={colors.text}
          />
        </Pressable>
        <RnText style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}>
          Enter your password
        </RnText>
      </RnView>
      <KeyboardAvoidingView behavior="padding" style={[s.flex1]}>
        <RnView style={[s.flex1, s.px16, s.mt20]}>
          <Controller
            control={control}
            name="password"
            rules={{ required: true, minLength: 8 }}
            render={({ field: { onChange, onBlur, value } }) => (
              <RnTextInput
                style={[
                  s.input,
                  s.f16,
                  s.w100pct,
                  {
                    fontFamily: fonts.regular.fontFamily,
                    color: colors.text,
                    borderColor: errors.root
                      ? colors.danger
                      : colors.lightBackground,
                  },
                ]}
                ref={inputRef}
                autoFocus
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="none"
                secureTextEntry
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="**********"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.root ? (
            <RnText
              style={[
                atoms.text_2xs,
                {
                  top: 5,
                  color: colors.danger,
                  fontFamily: fonts.regular.fontFamily,
                },
              ]}
            >
              {errors.root.message}
            </RnText>
          ) : (
            <RnText
              style={[
                atoms.text_2xs,
                { top: 5, fontFamily: fonts.regular.fontFamily },
              ]}
            >
              Password must be at least 8 characters long.
            </RnText>
          )}
        </RnView>
        <RnView
          style={[
            s.flex1,
            s.justifyFlexEnd,
            { marginBottom: insets.bottom * 2 },
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
                    isValid && !isSubmitting
                      ? themes.green_600
                      : colors.disabled_bg,
                },
              ]}
              onPress={_login}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.disabledText} />
              ) : (
                <RnText
                  style={[
                    { color: isValid ? colors.text : colors.disabledText },
                  ]}
                >
                  Login
                </RnText>
              )}
            </PressableWithFeedBack>
          </RnView>
        </RnView>
      </KeyboardAvoidingView>
    </RnView>
  );
};
LogInScreen.displayName = "LogInScreen";
