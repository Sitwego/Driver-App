import { Pressable } from "react-native";
import RnText from "~/components/RnText";
import { RnView } from "~/components/RnView";
import { s } from "~/styles/Common-Styles";
import { atoms } from "./theme/atoms";
import Icon from "~/components/Icons";
import { useAppTheme } from "./theme/ThemeProvider";
import { useMemo } from "react";

// looks like a TextField.Input, but is just a button. It'll do something different on each platform on press
// iOS: open a dialog with an inline date picker
// Android: open the date picker modal

export function DateFieldButton({
  label,
  value,
  onPress,
  isInvalid,
  accessibilityHint,
}: {
  label: string;
  value: string | Date;
  onPress: () => void;
  isInvalid?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useAppTheme();

  const date = useMemo(
    () => (value ? new Date(value).toLocaleDateString() : ""),
    [value],
  );

  return (
    <RnView style={[s.relative, s.w100pct]}>
      <Pressable
        onPress={onPress}
        // onPressIn={onPressIn}
        // onPressOut={onPressOut}
        // onFocus={onFocus}
        // onBlur={onBlur}
        style={[
          {
            borderColor: colors.lightBackground,
            borderWidth: 1,
          },
          s.flexDirectionRow,
          s.w100pct,
          s.borderRadius_sm,
          s.alignCenter,
          s.p16,
          // hovered ? chromeHover : {},
          // focused || pressed ? chromeFocus : {},
          // isInvalid || isInvalid ? chromeError : {},
          // (isInvalid || isInvalid) && (hovered || focused)
          //   ? chromeErrorHover
          //   : {},
        ]}
      >
        <Icon
          name="CalendarDays"
          size={20}
          strokeWidth={2}
          color={colors.text}
        />
        <RnText style={[atoms.text_md, atoms.pl_xs, atoms.text_md]}>
          {date}
        </RnText>
      </Pressable>
    </RnView>
  );
}
