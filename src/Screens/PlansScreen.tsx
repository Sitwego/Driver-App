import { PressableScale } from "pressto";
import { memo, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export default memo(function PlansScreen(props: any) {
  const { navigation } = props;
  const { colors, fonts } = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {};
  }, []);

  const pushToPayment = useCallback(() => {
    navigation.push("Payment");
  }, [navigation]);

  return (
    <RnView style={[s.flex1]}>
      <RnView
        style={[
          s.w100pct,
          s.px10,
          s.py5,
          { height: 80, backgroundColor: themes.bg_900 },
        ]}
      >
        <RnView
          style={[
            s.flex1,
            s.flexDirectionRow,
            s.justifyBetween,
            { marginTop: insets.top },
          ]}
        >
          <RnText>Plan</RnText>
          <RnView>
            <RnText
              style={[
                atoms.text_sm,
                { color: colors.primary, fontFamily: fonts.heavy.fontFamily },
              ]}
            >
              View Payment History
            </RnText>
          </RnView>
        </RnView>
      </RnView>
      <RnView style={{ marginVertical: 16 }} />
      <RnView style={[s.flexCol, s.flex1, s.gap20, s.px10]}>
        <RnView
          style={[
            { backgroundColor: themes.bg_900 },
            s.w100pct,
            s.py5,
            s.px5,
            s.borderRadius_xs,
          ]}
        >
          <RnText
            style={[
              atoms.text_md,
              { fontFamily: fonts.heavy.fontFamily, color: themes.gray_50 },
            ]}
          >
            My Dues
          </RnText>
          <RnView style={[{ marginTop: 8 }]}>
            <RnText style={[atoms.text_xs, { color: themes.bg_100 }]}>
              Pay for your subscription for the last 7 days
            </RnText>
          </RnView>
          <RnView style={[s.w100pct, { marginTop: 16, paddingBottom: 16 }]}>
            <RnText
              style={[
                atoms.text_2xl,
                //@ts-ignore -- ts compiler is not smart enough here
                atoms.text_center,
                { fontFamily: fonts.heavy.fontFamily },
              ]}
            >
              Ksh 125.0
            </RnText>
          </RnView>
          <PressableScale
            style={[
              s.p16,
              s.alignCenter,
              s.justifyCenter,
              s.borderRadius_xs,
              { backgroundColor: colors.primary },
            ]}
            onPress={pushToPayment}
          >
            <RnText
              style={[atoms.text_md, { fontFamily: fonts.heavy.fontFamily }]}
            >
              Pay
            </RnText>
          </PressableScale>
        </RnView>
        <RnView style={[s.w100pct, s.flexCol, s.gap16]}>
          <RnView style={[s.flexDirectionRow, s.justifyBetween]}>
            <RnText
              style={[
                atoms.text_md,
                { fontFamily: fonts.heavy.fontFamily, color: themes.gray_50 },
              ]}
            >
              Current Plan
            </RnText>
            <RnView
              style={[
                s.alignCenter,
                s.justifyCenter,
                s.py6,
                s.px10,
                s.borderRadius_full,
                { backgroundColor: themes.bg_975 },
              ]}
            >
              <RnText
                style={[
                  atoms.text_xs,
                  {
                    fontFamily: fonts.heavy.fontFamily,
                    color: themes.green_500,
                  },
                ]}
              >
                Active
              </RnText>
            </RnView>
          </RnView>
          <RnView
            style={[
              { backgroundColor: themes.bg_900, width: "95%" },
              s.alignSelf,
              s.py5,
              s.px5,
              s.borderRadius_xs,
            ]}
          >
            <RnText>Plan Here</RnText>
          </RnView>
        </RnView>
      </RnView>
    </RnView>
  );
});
