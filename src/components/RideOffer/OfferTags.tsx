import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { formatDistance } from "~/utils/geo";
import { roundToOneDecimal } from "~/utils/metrics/numbers";

import RnText from "../RnText";

type Props = {
  /** Vehicle class, e.g. "Bike" / "TukTuk". */
  vc?: string | null;
  /** Distance from the driver to the pickup point, in kilometres. */
  distanceToPickup?: number | null;
};

const OfferTags = ({ vc, distanceToPickup }: Props) => {
  const { colors, fonts } = useAppTheme();

  // A missing or zero pickup distance means the backend didn't resolve one —
  // showing "0 KM" would read as "you are already there", so drop the pill.
  const hasPickupDistance =
    typeof distanceToPickup === "number" &&
    Number.isFinite(distanceToPickup) &&
    distanceToPickup > 0;

  if (!vc && !hasPickupDistance) return null;

  return (
    <View style={styles.row}>
      {vc ? (
        <View
          style={[
            atoms.rounded_xs,
            atoms.px_sm,
            atoms.py_2xs,
            { backgroundColor: colors.primary },
          ]}
        >
          <RnText
            style={[
              atoms.text_xs,
              { fontFamily: fonts.heavy.fontFamily, color: "#fff" },
            ]}
          >
            {vc.toUpperCase()}
          </RnText>
        </View>
      ) : (
        <View />
      )}

      {hasPickupDistance ? (
        <View
          style={[
            atoms.rounded_xs,
            atoms.px_sm,
            atoms.py_2xs,
            atoms.border,
            atoms.bg_transparent,
            { borderColor: colors.lightGray },
          ]}
        >
          <RnText style={[atoms.text_xs, { color: colors.lightGray }]}>
            {formatDistance(distanceToPickup)}
          </RnText>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

export default memo(OfferTags);
