import { memo } from "react";
import { StyleSheet, View } from "react-native";

import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { atoms } from "~/ui/theme/atoms";
import { themes } from "~/ui/theme/theme_utils";
import {
  StopLabels,
  StopLocation,
  deriveStopLabels,
} from "~/utils/rideStopLabels";

import RnText from "../RnText";

const MARKER_COLUMN = 24;
const MARKER_SIZE = 12;
// atoms.text_lg is 18px; this drops the marker onto that first line's optical
// centre so the rail lines up with the headline, not the top of the row.
const MARKER_TOP_OFFSET = 5;
// Breathing room between the two stops, carried by the pickup row so the
// connector line spans it.
const STOP_GAP = 20;

type StopProps = {
  labels: StopLabels;
  marker: React.ReactNode;
  /**
   * Pickup grows a connector that fills whatever height its (possibly wrapped)
   * address takes; destination gets a short stub joining it to that line. The
   * rail is built from these two pieces rather than one absolutely-positioned
   * element so it always ends exactly at the destination marker.
   */
  variant: "start" | "end";
};

const Stop = memo(({ labels, marker, variant }: StopProps) => {
  const { colors, fonts } = useAppTheme();
  const isStart = variant === "start";

  return (
    <View style={styles.stopRow}>
      <View style={styles.markerColumn}>
        {isStart ? null : (
          <View style={[styles.connector, styles.connectorStub]} />
        )}
        {marker}
        {isStart ? <View style={[styles.connector, atoms.flex_1]} /> : null}
      </View>
      <View style={[styles.textColumn, isStart && styles.textColumnStart]}>
        <RnText
          numberOfLines={2}
          style={[atoms.text_lg, { fontFamily: fonts.heavy.fontFamily }]}
        >
          {labels.primary}
        </RnText>
        {labels.secondary ? (
          <RnText
            numberOfLines={2}
            style={[atoms.text_sm, { color: colors.lightGray }]}
          >
            {labels.secondary}
          </RnText>
        ) : null}
      </View>
    </View>
  );
});
Stop.displayName = "Stop";

type Props = {
  from?: StopLocation | null;
  to?: StopLocation | null;
};

const OfferRoute = ({ from, to }: Props) => {
  const { colors } = useAppTheme();

  const pickup = deriveStopLabels(from, "Pickup");
  const dropoff = deriveStopLabels(to, "Destination");

  return (
    <View>
      <Stop
        variant="start"
        labels={pickup}
        marker={
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        }
      />
      <Stop
        variant="end"
        labels={dropoff}
        marker={
          <View style={[styles.square, { backgroundColor: colors.danger }]} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stopRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  markerColumn: {
    width: MARKER_COLUMN,
    alignItems: "center",
    paddingTop: MARKER_TOP_OFFSET,
  },
  connector: {
    width: 1,
    backgroundColor: themes.bg_700,
  },
  // Bridges the destination row's top padding up to the pickup row's line.
  connectorStub: {
    height: MARKER_TOP_OFFSET,
    marginTop: -MARKER_TOP_OFFSET,
  },
  dot: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
  },
  square: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: 2,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  textColumnStart: {
    paddingBottom: STOP_GAP,
  },
});

export default memo(OfferRoute);
