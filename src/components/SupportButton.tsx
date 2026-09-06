import { Pressable } from "react-native";

import Icon from "~/components/Icons";
import RnText from "~/components/RnText";
import { s } from "~/styles/Common-Styles";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { SUPPORT_PHONE, openWhatsApp } from "~/utils/open_uri";

type SupportButtonProps = {
  /**
   * What the driver's WhatsApp message is pre-filled with. Worth setting per
   * screen: support otherwise opens on a bare "Hi" and has to ask what the
   * driver was looking at.
   */
  message?: string;
  label?: string;
};

/**
 * A compact "Help" pill that opens WhatsApp to driver support.
 *
 * Sized for a navigation header's `headerRight`, but it is an ordinary view and
 * works anywhere. Uses react-native's `Pressable` rather than `pressto`'s
 * `PressableScale`, because that one is a gesture-handler button and the native
 * stack header hosts its views outside the gesture tree the app root provides.
 */
export function SupportButton({
  message = "Hi👋, I need help with my account.",
  label = "Help",
}: SupportButtonProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => openWhatsApp(SUPPORT_PHONE, message)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Contact support on WhatsApp"
      style={[
        s.flexDirectionRow,
        s.alignCenter,
        s.gap6,
        {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          backgroundColor: colors.lightBackground,
        },
      ]}
    >
      <Icon name="Headset" size={16} color={colors.primary} />
      <RnText style={[atoms.text_xs, { color: colors.primary }]}>
        {label}
      </RnText>
    </Pressable>
  );
}
