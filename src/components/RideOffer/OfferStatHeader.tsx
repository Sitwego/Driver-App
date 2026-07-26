import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import { formatPrice, roundToOneDecimal } from "~/utils/metrics/numbers";

import RnText from "../RnText";

type StatProps = {
  label: string;
  value: string;
  unit: string;
};

// A driver decides on an offer in under 20s, so fare and distance are the
// largest things on screen — label small and muted, numeral oversized, unit
// baseline-aligned beside it so the two columns read as one comparison.
const Stat = memo(({ label, value, unit }: StatProps) => {
  const { colors, fonts } = useAppTheme();
  return (
    <View style={styles.column}>
      <RnText style={[atoms.text_sm, { color: colors.lightGray }]}>
        {label}
      </RnText>
      <View style={[styles.valueRow, atoms.gap_2xs]}>
        <RnText
          numberOfLines={1}
          style={[atoms.text_4xl, { fontFamily: fonts.heavy.fontFamily }]}
        >
          {value}
        </RnText>
        <RnText
          style={[atoms.text_sm, styles.unit, { color: colors.lightGray }]}
        >
          {unit}
        </RnText>
      </View>
    </View>
  );
});
Stat.displayName = "Stat";

type Props = {
  /** Ride fare in KSH. */
  fare: number;
  /** Trip distance, already in kilometres (see RideData.distance). */
  distanceKm: number;
};

const OfferStatHeader = ({ fare, distanceKm }: Props) => {
  const fareLabel = useMemo(() => formatPrice(fare ?? 0), [fare]);
  const distanceLabel = useMemo(
    () => String(roundToOneDecimal(distanceKm ?? 0)),
    [distanceKm],
  );

  return (
    <View style={[styles.panel, atoms.rounded_md, atoms.p_lg, atoms.gap_md]}>
      <Stat label="Net Fare" value={fareLabel} unit="KSH" />
      <Stat label="Trip Distance" value={distanceLabel} unit="KM" />
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: themes.bg_900,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unit: {
    // Nudged off the baseline so the unit sits with the numeral's x-height
    // rather than floating level with its full cap height.
    transform: [{ translateY: -2 }],
  },
});

export default memo(OfferStatHeader);
