import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Controller, useForm } from "react-hook-form";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import RnTextInput from "~/components/RnTextInput";
import { useRef } from "react";
import { DateFieldRef, DateInputField } from "~/ui/DateComponent";
import { Pressable, ActivityIndicator } from "react-native";
import { atoms } from "~/ui/theme/atoms";
import { useUserState, useUserApi } from "~/lib/state/userState";
import { useUpdatePersonalDetails } from "~/hooks/apis";
import { NavigationProps } from "~/navigation/types";
import { showSuccessToast } from "~/components/Toast";

const MIN_AGE_DATE = new Date(Date.now() - 60e3 * 60 * 24 * 365 * 20);

type PersonalDetailsForm = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: Date;
};

export function EditPersonalDetails({
  navigation,
}: NavigationProps<"EditPersonalDetails">) {
  const { colors, fonts } = useAppTheme();
  const dateRef = useRef<DateFieldRef>(null);
  const insets = useSafeAreaInsets();
  const userState = useUserState();
  const { updateProfile } = useUserApi();
  const { mutateAsync: savePersonalDetails, isPending } =
    useUpdatePersonalDetails();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PersonalDetailsForm>({
    defaultValues: {
      first_name: userState.first_name ?? "",
      middle_name: userState.middle_name ?? "",
      last_name: userState.last_name ?? "",
      date_of_birth: userState.date_of_birth
        ? new Date(userState.date_of_birth)
        : MIN_AGE_DATE,
    },
  });

  const inputStyle = [
    s.input,
    s.f16,
    s.w100pct,
    {
      fontFamily: fonts.regular.fontFamily,
      color: colors.text,
      height: 50,
      borderColor: colors.lightBackground,
    },
  ] as const;

  const onSubmit = async (data: PersonalDetailsForm) => {
    await savePersonalDetails(data);
    console.log("Updating user state with new personal details:", data);
    updateProfile({
      first_name: data.first_name,
      middle_name: data.middle_name,
      last_name: data.last_name,
      date_of_birth: data.date_of_birth,
    });
    showSuccessToast("Personal details saved successfully");
    navigation.popToTop();
  };

  return (
    <RnView style={[s.flexBox]}>
      <KeyboardAwareScrollView
        bottomOffset={100}
        disableScrollOnKeyboardHide
        contentContainerStyle={[s.px10, s.py16, { flexGrow: 1 }]}
      >
        <RnView style={[s.mb20, s.gap8]}>
          <RnText>First Name</RnText>
          <Controller
            name="first_name"
            rules={{ required: "First name is required" }}
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[
                  inputStyle,
                  errors.first_name && { borderColor: colors.danger },
                ]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="words"
                inputMode="text"
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="John"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.first_name && (
            <RnText style={{ color: colors.danger, fontSize: 12 }}>
              {errors.first_name.message}
            </RnText>
          )}
        </RnView>

        <RnView style={[s.mb20, s.gap8]}>
          <RnText>Middle Name</RnText>
          <Controller
            name="middle_name"
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[inputStyle]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="words"
                inputMode="text"
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Middle (optional)"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
        </RnView>

        <RnView style={[s.mb20, s.gap8]}>
          <RnText>Last Name</RnText>
          <Controller
            name="last_name"
            rules={{ required: "Last name is required" }}
            control={control}
            render={({ field: { onBlur, onChange, value } }) => (
              <RnTextInput
                style={[
                  inputStyle,
                  errors.last_name && { borderColor: colors.danger },
                ]}
                autoCorrect={false}
                cursorColor={colors.lightBackground}
                autoCapitalize="words"
                inputMode="text"
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Doe"
                placeholderTextColor={colors.lightGray}
                value={value}
              />
            )}
          />
          {errors.last_name && (
            <RnText style={{ color: colors.danger, fontSize: 12 }}>
              {errors.last_name.message}
            </RnText>
          )}
        </RnView>

        <RnView style={[s.mb20, s.gap8]}>
          <RnText>Date of Birth</RnText>
          <Controller
            name="date_of_birth"
            rules={{ required: "Date of birth is required" }}
            control={control}
            render={({ field: { onChange, value } }) => (
              <DateInputField
                inputRef={dateRef}
                value={value ?? MIN_AGE_DATE}
                maximumDate={MIN_AGE_DATE}
                onChangeDate={(date) => {
                  if (date) onChange(date);
                }}
                label={"Date of Birth"}
              />
            )}
          />
          {errors.date_of_birth && (
            <RnText style={{ color: colors.danger, fontSize: 12 }}>
              {errors.date_of_birth.message}
            </RnText>
          )}
        </RnView>

        <RnView
          style={[
            s.flexBox,
            s.justifyFlexEnd,
            { marginBottom: insets.bottom + 100 },
          ]}
        >
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={isPending}
            style={[
              s.p16,
              s.alignCenter,
              s.alignSelf,
              s.w100pct,
              s.borderRadius_sm,
              {
                backgroundColor: isPending
                  ? colors.disabled_bg
                  : colors.primary,
              },
            ]}
          >
            {isPending ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <RnText
                style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}
              >
                Save
              </RnText>
            )}
          </Pressable>
        </RnView>
      </KeyboardAwareScrollView>
    </RnView>
  );
}
