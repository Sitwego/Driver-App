// ----------------------------------------------------------------
// Step 5 — VehicleMarker: the marker-driving strategies, plus the
// traveled-route polyline split.
//
// PRIMARY strategy ("animatedProps"): useAnimatedProps writes
// coordinate/rotation/opacity from shared values straight into the
// native marker view — no React reconciliation per frame. This is
// the spec-prescribed New-Architecture path.
//
// FALLBACK strategy ("segmentAnimation"): only if animatedProps on
// the Google-provider <Marker> proves unreliable. A coarse 150 ms
// JS-side tick reads the shared values and calls the marker's native
// animateMarkerToCoordinate(coord, 150) with LINEAR easing implied —
// each segment animation ends exactly when the next begins, chaining
// into visually continuous motion. Rotation updates via setState at
// the same cadence (leaf-only re-render).
//
// Per-frame setState / per-frame coordinate props are forbidden — see
// REALTIMETRACKING.md Step 5.
// ----------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Marker, Polyline, type MapMarker } from "react-native-maps";
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from "react-native-reanimated";

import { splitRouteAt } from "./routeGeometry";
import type { LatLng, RouteTable } from "./types";

const AnimatedMarker = Animated.createAnimatedComponent(Marker);

// Without this, Reanimated treats coordinate/rotation/opacity as "JS
// props" and dispatches every animatedProps update through the JS
// thread per frame (visually fine, but it pegs mqt_js). Whitelisting
// keeps the whole update on the UI thread.
Animated.addWhitelistedNativeProps({
  coordinate: true,
  rotation: true,
  opacity: true,
});

export type MarkerStrategy = "animatedProps" | "segmentAnimation";

export interface VehicleMarkerProps {
  lat: SharedValue<number>;
  lng: SharedValue<number>;
  bearing: SharedValue<number>;
  opacity: SharedValue<number>;
  /** No marker is rendered until the pipeline has positioned the vehicle. */
  hasFix: SharedValue<boolean>;
  strategy?: MarkerStrategy;
  /** Custom icon; defaults to the brand-green arrow puck. */
  children?: React.ReactNode;
}

/** Cadence of the fallback segment animation (and its duration). */
const SEGMENT_MS = 150;
/** JS-side poll for "has the first fix arrived yet". */
const MOUNT_POLL_MS = 250;
/**
 * How long to leave tracksViewChanges on after (re)mount. On Android,
 * react-native-maps rasterizes the marker's child into a bitmap ONCE
 * when tracksViewChanges is false; an <Image> icon that is still
 * decoding at that instant captures blank. Keeping it true briefly lets
 * the icon paint, then we turn it off so the marker stops redrawing
 * every map frame (the fps killer the spec warns about).
 */
const ICON_SETTLE_MS = 1500;

/**
 * true for the first ICON_SETTLE_MS after mount (so an image icon is
 * captured), then false forever (performance). `key` resets it — used
 * so a changed icon re-rasterizes for one settle window.
 */
function useIconSettle(key: unknown): boolean {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    setTracks(true);
    const id = setTimeout(() => setTracks(false), ICON_SETTLE_MS);
    return () => clearTimeout(id);
  }, [key]);
  return tracks;
}

/**
 * Mount gate: the native marker mounts once, after the first fix, and
 * never remounts — Fabric dislikes map children appearing/disappearing,
 * and mounting at (0,0) would flash a marker off the coast of Africa.
 */
function useMountedAfterFirstFix(hasFix: SharedValue<boolean>): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (mounted) return;
    const id = setInterval(() => {
      if (hasFix.value) setMounted(true);
    }, MOUNT_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);
  return mounted;
}

const VehicleMarkerComponent = ({
  lat,
  lng,
  bearing,
  opacity,
  hasFix,
  strategy = "animatedProps",
  children,
}: VehicleMarkerProps) => {
  const mounted = useMountedAfterFirstFix(hasFix);
  if (!mounted) return null;
  const icon = children ?? <DefaultVehicleIcon />;
  return strategy === "animatedProps" ? (
    <AnimatedPropsMarker {...{ lat, lng, bearing, opacity }}>
      {icon}
    </AnimatedPropsMarker>
  ) : (
    <SegmentAnimationMarker {...{ lat, lng, bearing, opacity }}>
      {icon}
    </SegmentAnimationMarker>
  );
};

export const VehicleMarker = React.memo(VehicleMarkerComponent);

interface StrategyProps {
  lat: SharedValue<number>;
  lng: SharedValue<number>;
  bearing: SharedValue<number>;
  opacity: SharedValue<number>;
  children: React.ReactNode;
}

const AnimatedPropsMarker = ({
  lat,
  lng,
  bearing,
  opacity,
  children,
}: StrategyProps) => {
  const animatedProps = useAnimatedProps(() => ({
    coordinate: { latitude: lat.value, longitude: lng.value },
    rotation: bearing.value,
    opacity: opacity.value,
  }));
  // Initial coordinate: the shared values are already populated (the
  // marker only mounts after the first fix), so a JS-side read is safe.
  const initial = useMemo(
    () => ({ latitude: lat.value, longitude: lng.value }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const tracksViewChanges = useIconSettle(children);
  return (
    <AnimatedMarker
      animatedProps={animatedProps}
      coordinate={initial}
      flat
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      {children}
    </AnimatedMarker>
  );
};

const SegmentAnimationMarker = ({
  lat,
  lng,
  bearing,
  opacity,
  children,
}: StrategyProps) => {
  const ref = useRef<MapMarker | null>(null);
  // Rotation/opacity go through a coarse leaf-only setState — the
  // coordinate itself animates natively, so this re-render is cheap
  // and never touches the marker position.
  const [decor, setDecor] = useState({ rotation: 0, opacity: 1 });
  const initial = useMemo(
    () => ({ latitude: lat.value, longitude: lng.value }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const tracksViewChanges = useIconSettle(children);

  useEffect(() => {
    const id = setInterval(() => {
      const coord = { latitude: lat.value, longitude: lng.value };
      // Chained native segment animations: duration === cadence, so each
      // animation ends exactly as the next begins (linear, no pulsing).
      ref.current?.animateMarkerToCoordinate(coord, SEGMENT_MS);
      setDecor((prev) => {
        const rotation = bearing.value;
        const op = opacity.value;
        return prev.rotation === rotation && prev.opacity === op
          ? prev
          : { rotation, opacity: op };
      });
    }, SEGMENT_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Marker
      ref={ref}
      coordinate={initial}
      rotation={decor.rotation}
      opacity={decor.opacity}
      flat
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      {children}
    </Marker>
  );
};

/** Brand-green arrow puck; rasterized by tracksViewChanges={false}. */
const DefaultVehicleIcon = () => (
  <View style={styles.puck}>
    <View style={styles.arrow} />
  </View>
);

// ----------------------------------------------------------------
// Traveled-route dimming
// ----------------------------------------------------------------

export interface TrackedRoutePolylinesProps {
  table: RouteTable;
  dRender: SharedValue<number>;
  /** Split recompute cadence; spec caps it at 2×/s. */
  updateMs?: number;
  /** Color of the not-yet-traveled part (defaults to brand green). */
  aheadColor?: string;
  /** Color of the traveled (dimmed) part. */
  behindColor?: string;
}

/**
 * Splits the route into a dimmed traveled polyline and a brand-green
 * ahead polyline at dRender. Recomputed at most 2×/s (spec) and only
 * when the vehicle has moved ≥ 10 m — polyline re-render is expensive
 * and must never steal frame budget.
 */
const TrackedRoutePolylinesComponent = ({
  table,
  dRender,
  updateMs = 500,
  aheadColor = "#6b9f77",
  behindColor = "rgba(120, 125, 140, 0.45)",
}: TrackedRoutePolylinesProps) => {
  const [split, setSplit] = useState<{ behind: LatLng[]; ahead: LatLng[] }>(
    () => splitRouteAt(table, 0),
  );
  const lastD = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const d = dRender.value;
      if (Math.abs(d - lastD.current) < 10) return;
      lastD.current = d;
      setSplit(splitRouteAt(table, d));
    }, updateMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, updateMs]);

  return (
    <>
      {split.behind.length >= 2 && (
        <Polyline
          coordinates={split.behind}
          strokeColor={behindColor}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      )}
      {split.ahead.length >= 2 && (
        <Polyline
          coordinates={split.ahead}
          strokeColor={aheadColor}
          strokeWidth={6}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </>
  );
};

export const TrackedRoutePolylines = React.memo(TrackedRoutePolylinesComponent);

const styles = StyleSheet.create({
  puck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#6b9f77",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    width: 0,
    height: 0,
    marginBottom: 3,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ffffff",
  },
});
