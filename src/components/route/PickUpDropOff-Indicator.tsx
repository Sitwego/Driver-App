import { memo, useMemo } from "react";
import { Canvas, Circle, Rect, Line } from "@shopify/react-native-skia";
import { View, StyleSheet } from "react-native";
import { atoms } from "~/ui/theme/atoms";
import RnText from "../RnText";
import { useAppTheme } from "~/ui/theme/ThemeProvider";
import { themes } from "~/ui/theme/theme_utils";

export type PickupToDestinationProps = {
  from: FromToLocationType;
  to: FromToLocationType;
};
export type FromToLocationType = {
  city?: string | null;
  street?: string | null;
  ward?: string | null;
  country?: string;
};

// --- all geometry is fixed — computed once at module load, never again ---
const PICKUP_X = 25;
const PICKUP_Y = 20;
const DEST_X = 25;
const DEST_Y = 65;
const DOT_RADIUS = 6;
const SQUARE_SIZE = 10;
const SQUARE_HALF = SQUARE_SIZE / 2;
const CANVAS_HEIGHT = Math.abs(DEST_Y - PICKUP_Y) + 40; // 85

// Skia shapes are entirely static except for the destination fill color (theme).
// Isolating them into a memo'd component means Skia skips GPU repainting on
// every from/to prop update — it only repaints when the theme actually changes.
const RouteIndicatorCanvas = memo(({ fillColor }: { fillColor: string }) => (
  <Canvas style={styles.canvas}>
    {/* Line drawn first so circles/square render on top of it */}
    <Line
      p1={{ x: PICKUP_X, y: PICKUP_Y }}
      p2={{ x: DEST_X, y: DEST_Y }}
      color={themes.bg_300}
      style="stroke"
      strokeWidth={1}
    />
    <Circle
      cx={PICKUP_X}
      cy={PICKUP_Y}
      r={DOT_RADIUS}
      color={themes.bg_300}
      style="fill"
    />
    <Circle
      cx={PICKUP_X}
      cy={PICKUP_Y}
      r={DOT_RADIUS}
      color="black"
      style="stroke"
      strokeWidth={1}
    />
    <Rect
      x={DEST_X - SQUARE_HALF}
      y={DEST_Y - SQUARE_HALF}
      width={SQUARE_SIZE}
      height={SQUARE_SIZE}
      color={fillColor}
      style="fill"
    />
    <Rect
      x={DEST_X - SQUARE_HALF}
      y={DEST_Y - SQUARE_HALF}
      width={SQUARE_SIZE}
      height={SQUARE_SIZE}
      color={themes.bg_600}
      style="stroke"
      strokeWidth={4}
    />
  </Canvas>
));
RouteIndicatorCanvas.displayName = "RouteIndicatorCanvas";

// Shared text row for both pickup and destination — eliminates duplicated structure.
const LocationLabel = memo(
  ({
    ward,
    city,
    wardStyle,
    cityStyle,
    containerStyle,
  }: FromToLocationType & {
    wardStyle: object;
    cityStyle: object;
    containerStyle?: object;
  }) => (
    <View style={containerStyle}>
      {ward && <RnText style={wardStyle}>{ward}</RnText>}
      {city && <RnText style={cityStyle}>{city}</RnText>}
    </View>
  ),
);
LocationLabel.displayName = "LocationLabel";

const PickupToDestination = ({ from, to }: PickupToDestinationProps) => {
  const { colors, fonts } = useAppTheme();

  // StyleSheet.create registers styles as integer IDs — inline objects skip that.
  // Memoize here so the registered styles are stable across re-renders.
  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        ward: { color: colors.lightGray },
        city: { fontFamily: fonts.heavy.fontFamily },
      }),
    [colors.lightGray, fonts.heavy.fontFamily],
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <RouteIndicatorCanvas fillColor={colors.text} />
        <View style={styles.textColumn}>
          <LocationLabel
            {...from}
            wardStyle={[atoms.text_sm, dynamicStyles.ward]}
            cityStyle={[atoms.text_2xs, dynamicStyles.city]}
            containerStyle={atoms.gap_xs}
          />
          <LocationLabel
            {...to}
            wardStyle={[atoms.text_sm, dynamicStyles.ward]}
            cityStyle={[atoms.text_2xs, dynamicStyles.city]}
            containerStyle={styles.destinationLabel}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { left: -10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  canvas: {
    width: 40,
    height: CANVAS_HEIGHT,
  },
  textColumn: {
    height: CANVAS_HEIGHT,
  },
  destinationLabel: {
    flex: 1,
    gap: 4,
    justifyContent: "flex-end",
  },
});

export default memo(
  PickupToDestination,
  (prev, next) =>
    prev.from.city === next.from.city &&
    prev.from.ward === next.from.ward &&
    prev.to.city === next.to.city &&
    prev.to.ward === next.to.ward,
);
