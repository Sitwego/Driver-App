import { PressableScale as Pressable } from "pressto";
import React, { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import RnTextInput from "~/components/RnTextInput";
import { RnView } from "~/components/RnView";
import { useUserApi } from "~/lib/state/userState";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";

import { AuthScreenState } from "./AuthScreenType";

interface Props {
  setScreen: (prop?: AuthScreenState) => void;
  phone_number?: string;
}

type UserFormData = {
  name: string;
  password: string;
  email: string;
};

function getCreateAccountErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const message = (err as { message?: unknown })?.message;
  if (status === 409)
    return "An account with this phone number already exists.";
  if (status === 422) return "Please check your details and try again.";
  if (status === 429)
    return "Too many attempts. Please wait before trying again.";
  if (typeof message === "string" && message.length > 0 && message.length < 120)
    return message;
  return "Something went wrong. Please try again.";
}

export const CreateAccountScreen: React.FC<Props> = ({
  setScreen,
  phone_number,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<UserFormData>({ mode: "onChange" });
  const { createAccount } = useUserApi();

  const _goBack = useCallback(() => setScreen(undefined), [setScreen]);

  const _submitFn = useCallback(
    async ({ name, email, password }: UserFormData) => {
      const parts = name.trim().split(/\s+/);
      const first_name = parts[0];
      const last_name = parts.slice(1).join(" ");
      try {
        await createAccount({
          contact_data: {
            email,
            phone_number: phone_number as string,
          },
          first_name,
          last_name,
          gender: "Male",
          password,
          mobile_country_code: "+254",
        });
      } catch (err) {
        setError("root", { message: getCreateAccountErrorMessage(err) });
      }
    },
    [createAccount, phone_number, setError],
  );

  const _onSubmit = handleSubmit(_submitFn);
  return (
    <RnView style={{ flex: 1, paddingTop: insets.top }}>
      {/* Header */}
      <RnView
        style={[
          s.px16,
          s.py16,
          { flexDirection: "row", alignItems: "center", gap: 16 },
        ]}
      >
        <Pressable onPress={_goBack}>
          <Icon
            name="ArrowLeft"
            size={28}
            strokeWidth={2.5}
            color={colors.text}
          />
        </Pressable>
        <RnText style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}>
          Create account
        </RnText>
      </RnView>

      <KeyboardAwareScrollView
        bottomOffset={40}
        disableScrollOnKeyboardHide
        contentContainerStyle={[s.px16, s.py16, { gap: 20 }]}
      >
        {/* Name */}
        <RnView style={{ gap: 8 }}>
          <RnText style={[atoms.text_sm, { opacity: 0.7 }]}>Full name</RnText>
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Full name is required",
              validate: (v) =>
                v.trim().split(/\s+/).length >= 2 ||
                "Please enter both first and last name",
            }}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[
                  s.input,
                  s.f16,
                  s.w100pct,
                  {
                    fontFamily: fonts.regular.fontFamily,
                    color: colors.text,
                    borderColor: errors.name
                      ? colors.danger
                      : colors.lightBackground,
                  },
                ]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="words"
                inputMode="text"
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="John Doe"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.name && (
            <RnText style={[atoms.text_xs, { color: colors.danger }]}>
              {errors.name.message}
            </RnText>
          )}
        </RnView>

        {/* Email */}
        <RnView style={{ gap: 8 }}>
          <RnText style={[atoms.text_sm, { opacity: 0.7 }]}>
            Email address
          </RnText>
          <Controller
            name="email"
            control={control}
            rules={{
              required: "Email address is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email address",
              },
            }}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[
                  s.input,
                  s.f16,
                  s.w100pct,
                  {
                    fontFamily: fonts.regular.fontFamily,
                    color: colors.text,
                    borderColor: errors.email
                      ? colors.danger
                      : colors.lightBackground,
                  },
                ]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="none"
                inputMode="email"
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="john@example.com"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.email && (
            <RnText style={[atoms.text_xs, { color: colors.danger }]}>
              {errors.email.message}
            </RnText>
          )}
        </RnView>

        {/* Password */}
        <RnView style={{ gap: 8 }}>
          <RnText style={[atoms.text_sm, { opacity: 0.7 }]}>Password</RnText>
          <Controller
            name="password"
            control={control}
            rules={{
              required: "Password is required",
              minLength: {
                value: 8,
                message: "Password must be at least 8 characters",
              },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                message: "Must include uppercase, lowercase, and a number",
              },
            }}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[
                  s.input,
                  s.f16,
                  s.w100pct,
                  {
                    fontFamily: fonts.regular.fontFamily,
                    color: colors.text,
                    borderColor: errors.password
                      ? colors.danger
                      : colors.lightBackground,
                  },
                ]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="none"
                secureTextEntry
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Min. 8 chars, uppercase & number"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.password && (
            <RnText style={[atoms.text_xs, { color: colors.danger }]}>
              {errors.password.message}
            </RnText>
          )}
        </RnView>

        {errors.root && (
          <RnText style={[atoms.text_sm, { color: colors.danger }]}>
            {errors.root.message}
          </RnText>
        )}

        <Pressable
          onPress={() => _onSubmit()}
          enabled={isValid && !isSubmitting}
          style={[
            s.p16,
            s.alignCenter,
            {
              borderRadius: 12,
              backgroundColor:
                isValid && !isSubmitting
                  ? colors.primary
                  : colors.lightBackground,
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <RnText style={[s.textCenter]}>Continue</RnText>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </RnView>
  );
};
CreateAccountScreen.displayName = "CreateAccountScreen";
