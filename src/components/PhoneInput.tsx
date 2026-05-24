import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { PhoneInput } from "react-native-phone-entry";
import { atoms } from "~/ui/theme/atoms";
export type PhoneInputProps = {
  phone?: string;
  onPhoneTextChange?: (props: string) => void;
};
export default function PhoneInputComponet({
  phone,
  onPhoneTextChange,
}: PhoneInputProps) {
  const { colors, fonts } = useAppTheme();

  return (
    <>
      <PhoneInput
        defaultValues={{
          countryCode: "KE",
          callingCode: "+254",
          phoneNumber: "+254",
        }}
        value={phone}
        onChangeText={onPhoneTextChange}
        onChangeCountry={(country) => console.log("Country:", country)}
        autoFocus={true}
        disabled={false}
        countryPickerProps={{
          countryCode: "KE",
          onSelect: (country) => console.log("Selected country:", country),
        }}
        theme={{
          containerStyle: {
            backgroundColor: colors.background,
            borderColor: colors.lightBackground,
            borderRadius: 8,
            height: 50,
          },
          textInputStyle: {
            color: colors.text,
            paddingHorizontal: 5,
            fontFamily: fonts.regular.fontFamily,
            ...atoms.text_2xl,
          },
          flagButtonStyle: {
            borderRightWidth: 0,
            width: undefined,
          },
          codeTextStyle: {
            fontFamily: fonts.heavy.fontFamily,
          },
          enableDarkTheme: true,
        }}
        hideDropdownIcon={true}
        isCallingCodeEditable={false}
      />
    </>
  );
}
