import { useSafeAreaInsets } from "react-native-safe-area-context";
import PressableWithFeedBack from "~/components/PressableButton/PressableWithFeedBack";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export function PayOutScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();

  return (
    <RnView style={[s.flexBox, s.px16, s.mt10]}>
      <RnView style={[s.w100pct, s.justifyCenter, s.gap12, s.alignCenter]}>
        <RnText
          style={[
            atoms.text_md,
            s.textCenter,
            { fontFamily: fonts.heavy.fontFamily },
          ]}
        >
          Total Deposit
        </RnText>
        <RnView style={[s.alignSelf]}>
          <RnText
            style={[
              atoms.text_2xl,
              s.textCenter,
              { fontFamily: fonts.heavy.fontFamily },
            ]}
          >
            Ksh 4500.00
          </RnText>
        </RnView>
      </RnView>
      <RnView style={[s.mt20, s.w100pct]}>
        <PressableWithFeedBack
          style={[
            s.px6,
            s.borderRadius_sm,
            s.py14,
            s.justifyCenter,
            s.alignCenter,
            { backgroundColor: themes.bg_900 },
          ]}
        >
          <RnText
            style={[
              atoms.text_sm,
              {
                fontFamily: fonts.bold.fontFamily,
              },
            ]}
          >
            Edit Mpesa (+254701*** *57)
          </RnText>
        </PressableWithFeedBack>
      </RnView>
      <RnView style={[s.flexGrow1, s.justifyFlexEnd]}>
        <PressableWithFeedBack
          style={[
            s.p16,
            s.alignSelf,
            s.alignCenter,
            s.justifyCenter,
            s.borderRadius_full,
            {
              width: "80%",
              backgroundColor: colors.primary,
              marginBottom: insets.bottom + 80,
            },
          ]}
        >
          <RnText
            style={[atoms.text_sm, { fontFamily: fonts.bold.fontFamily }]}
          >
            Confirm Deposit
          </RnText>
        </PressableWithFeedBack>
      </RnView>
    </RnView>
  );
}
