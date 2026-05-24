import { PressableScale } from "pressto";
import React, { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OptionsPicker from "~/components/OptionPicker";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { preferences } from "~/lib/store/userPreferences";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export function PreferencesScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: { params: { preference: keyof typeof preferences } };
}) {
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { preference } = route.params;

  const [value, setValue] = React.useState("");
  const options = useMemo(() => preferences[preference] || [], [preference]);
  const onOptionSelected = (option: any) => {
    setValue(option);
  };

  return (
    <RnView
      style={[s.flexBox, s.gap12, s.px16, { marginTop: insets.top + 20 }]}
    >
      <RnView style={[s.pl10, s.gap20, s.w100pct, { flexWrap: "wrap" }]}>
        <RnText
          numberOfLines={2}
          style={[
            atoms.text_xl,
            { fontFamily: fonts.heavy.fontFamily, textTransform: "capitalize" },
          ]}
        >
          {preference}
        </RnText>
        <OptionsPicker
          options={options}
          selectedOption={value}
          onOptionSelected={onOptionSelected}
          style={[s.gap6]}
        />
      </RnView>
      <RnView style={[s.flexBox, s.justifyFlexEnd]}>
        <PressableScale
          style={[
            s.p16,
            s.borderRadius_full,
            s.alignSelf,
            s.alignCenter,
            s.justifyCenter,
            {
              backgroundColor: colors.primary,
              marginBottom: insets.bottom + 100,
              width: "40%",
            },
          ]}
        >
          <RnText>Save</RnText>
        </PressableScale>
      </RnView>
    </RnView>
  );
}
