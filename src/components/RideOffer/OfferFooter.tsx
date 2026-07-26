import { PressableScale as Pressable } from "pressto";
import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";

import RnText from "../RnText";

type Props = {
  onSkip: () => void;
  onAccept: () => void;
  /** True while the accept mutation is in flight. */
  disabled?: boolean;
};

const OfferFooter = ({ onSkip, onAccept, disabled = false }: Props) => {
  const { colors, fonts } = useAppTheme();

  return (
    <View style={[styles.row, atoms.gap_md]}>
      <Pressable
        onPress={disabled ? () => {} : onSkip}
        accessibilityRole="button"
        accessibilityLabel="Skip this ride request"
        accessibilityState={{ disabled }}
        style={[
          styles.button,
          atoms.rounded_md,
          styles.skip,
          { backgroundColor: themes.bg_800 },
        ]}
      >
        <RnText
          style={[
            atoms.text_md,
            { fontFamily: fonts.heavy.fontFamily, color: colors.text },
          ]}
        >
          SKIP
        </RnText>
      </Pressable>

      <Pressable
        onPress={disabled ? () => {} : onAccept}
        accessibilityRole="button"
        accessibilityLabel="Accept this ride request"
        accessibilityState={{ disabled }}
        style={[
          styles.button,
          atoms.rounded_md,
          styles.accept,
          {
            backgroundColor: disabled ? colors.disabled_bg : colors.primary,
          },
        ]}
      >
        <RnText
          style={[
            atoms.text_md,
            {
              fontFamily: fonts.heavy.fontFamily,
              color: disabled ? colors.disabledText : "#fff",
            },
          ]}
        >
          ACCEPT
        </RnText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  skip: {
    flex: 1,
  },
  // Weighted heavier than SKIP so ACCEPT reads as the primary action.
  accept: {
    flex: 1.4,
  },
});

export default memo(OfferFooter);
