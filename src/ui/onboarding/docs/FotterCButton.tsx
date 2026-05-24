import { PressableScale as Pressable } from "pressto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

type FooterButtonType = {
  onClose: () => void;
  disabled: boolean;
};
export function FooterButton({ onClose, disabled }: FooterButtonType) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  return (
    <RnView
      style={[
        s.flex1,
        s.justifyFlexEnd,
        s.w100pct,
        { marginBottom: insets.bottom + 20 },
      ]}
    >
      <Pressable
        onPress={onClose}
        style={[
          s.p16,
          s.justifyCenter,
          s.borderRadius_sm,
          s.alignCenter,
          s.w100pct,
          {
            backgroundColor: colors.primary,
          },
        ]}
      >
        <RnText style={[atoms.text_2xl]}>Save</RnText>
      </Pressable>
    </RnView>
  );
}
