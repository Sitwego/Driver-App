import { useSafeAreaInsets } from "react-native-safe-area-context";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "~/ui/theme/atoms";
import { useAppTheme } from "~/ui/theme/ThemeProvider";

export function EditProfilePicture({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();
  return (
    <RnView
      style={[
        s.flex1,
        s.px16,
        s.justifyCenter,
        s.alignCenter,
        { paddingTop: insets.top },
      ]}
    >
      <RnText style={[atoms.text_xl, { fontFamily: fonts.heavy.fontFamily }]}>
        This Feature is disabled for now. Come back soon
      </RnText>
    </RnView>
  );
}
