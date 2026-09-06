import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { DriverFareSplit } from "~/types/rideRequstTypes";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { formatWholeKes } from "~/utils/metrics/numbers";

import Icon from "../Icons";
import RnText from "../RnText";

type Props = {
  /** Already validated by `normalizeDriverFareSplit`. Null on a full-price ride. */
  split: DriverFareSplit | null;
};

/**
 * The cash instruction on a platform-funded offer: how much the rider actually
 * hands over, and who covers the rest.
 *
 * Sits BELOW `OfferStatHeader` and never modifies it, so "Net Fare" stays the
 * largest number on screen and keeps meaning the driver's earnings. Rendering
 * the reduced figure up there instead would read as a pay cut, which is exactly
 * what a platform-funded discount is not — the gap is credited against the
 * driver's subscription, so `you_earn` is untouched.
 *
 * Returns null when there is no promotion, leaving a full-price offer rendering
 * exactly as it did before this component existed.
 */
const OfferPromotionStrip = ({ split }: Props) => {
  const { colors, fonts } = useAppTheme();

  if (!split) return null;

  return (
    <View
      style={[
        styles.strip,
        atoms.rounded_md,
        atoms.p_md,
        atoms.gap_2xs,
        { backgroundColor: themes.green_975 },
      ]}
    >
      <View style={[styles.headline, atoms.gap_sm]}>
        <Icon name="Banknote" size={20} color={themes.green_500} />
        <RnText
          numberOfLines={1}
          style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}
        >
          Collect {formatWholeKes(split.collect_from_rider)} KSH in cash
        </RnText>
      </View>
      <View style={[styles.footnote, atoms.gap_2xs]}>
        <Icon name="BadgePercent" size={14} color={colors.lightGray} />
        <RnText
          style={[
            atoms.text_xs,
            styles.footnoteText,
            { color: colors.lightGray },
          ]}
        >
          Sitwego covers {formatWholeKes(split.platform_covers)} KSH · your
          earnings are unchanged
        </RnText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  strip: {
    width: "100%",
  },
  headline: {
    flexDirection: "row",
    alignItems: "center",
  },
  footnote: {
    flexDirection: "row",
    alignItems: "center",
  },
  footnoteText: {
    // Wraps to a second line on narrow devices; without this the row's
    // flexDirection lets the text overflow rather than wrap.
    flex: 1,
  },
});

export default memo(OfferPromotionStrip);
