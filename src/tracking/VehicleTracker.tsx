// ----------------------------------------------------------------
// Step 7 — VehicleTracker: the flag-gated production entry point.
//
// Render as a CHILD OF A MapView. Wires a FixSource + encoded route
// polyline to either:
//   • the full smooth pipeline (gate → snapper → motion model →
//     Reanimated animatedProps marker + traveled-route polylines), or
//   • the NAIVE fallback: a plain marker set per fix — the exact
//     pre-pipeline behavior — when `SMOOTH_VEHICLE_TRACKING` is off.
//
// The flag is sampled once per mount (a mid-trip flip must not tear
// down the pipeline). A NEW `encodedPolyline` is a leg switch: the
// geometry rebuilds, the monotonic clamp resets, and the vehicle
// re-projects onto the new route (handled inside useTrackedVehicle).
// ----------------------------------------------------------------

import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";

import { TrackedRoutePolylines, VehicleMarker } from "./VehicleMarker";
import { isSmoothTrackingEnabled } from "./flags";
import { getGeometryProvider } from "./mapsGeometry";
import { encodePolyline } from "./polyline";
import { pointAt } from "./routeGeometry";
import { useTrackedVehicle } from "./useTrackedVehicle";

import type { FixSource, LatLng, LocationFix } from "./types";

export interface VehicleTrackerProps {
  /** Transport boundary — network source and replay mock are interchangeable. */
  source: FixSource;
  /** Trip/leg route (Google encoding, precision 5). New value = leg switch. */
  encodedPolyline?: string;
  /**
   * Alternative to `encodedPolyline`: an already-decoded route (e.g.
   * `ride_line_str`). Re-encoded internally so the native geometry
   * module stays the authority. A new array = leg switch.
   */
  routePoints?: readonly LatLng[];
  /** 'boda' widens the off-route threshold (motorcycles leave the road). */
  rideType?: string;
  /** Draw the traveled/ahead split polylines (smooth path only). */
  showRoutePolylines?: boolean;
  /** Split-polyline colors (traveled part dims). */
  routeColors?: { ahead?: string; behind?: string };
  /** Custom marker icon; defaults to the brand-green arrow puck. */
  icon?: React.ReactNode;
}

const VehicleTrackerComponent = (props: VehicleTrackerProps) => {
  // Sampled once per mount: flipping the flag mid-trip must not rip the
  // running pipeline out from under the marker.
  const [smooth] = useState(isSmoothTrackingEnabled);
  // No usable route = nothing to snap to; the naive marker needs none.
  const hasRoute =
    !!props.encodedPolyline || (props.routePoints?.length ?? 0) >= 2;
  return smooth && hasRoute ? (
    <SmoothVehicle {...props} />
  ) : (
    <NaiveVehicle source={props.source} icon={props.icon} />
  );
};

export const VehicleTracker = React.memo(VehicleTrackerComponent);

const SmoothVehicle = ({
  source,
  encodedPolyline,
  routePoints,
  rideType,
  showRoutePolylines = true,
  routeColors,
  icon,
}: VehicleTrackerProps) => {
  // Normalize both route inputs to the encoded form — it is the stable
  // memo key AND what the native geometry module consumes.
  const encoded = useMemo(
    () => encodedPolyline ?? encodePolyline(routePoints ?? []),
    [encodedPolyline, routePoints],
  );
  const { table, provider } = useMemo(() => {
    const p = getGeometryProvider();
    return { table: p.prepareRoute(encoded), provider: p };
  }, [encoded]);

  const vehicle = useTrackedVehicle({
    table,
    geometry: provider,
    snapperOptions: { rideType },
  });

  // pushFix is stable across leg switches; resubscribe only if the
  // transport itself changes.
  const pushFix = vehicle.pushFix;
  useEffect(
    () =>
      source((fix) => {
        const outcome = pushFix(fix);
        if (__DEV__) {
          if (!outcome.result.accepted) {
            // eslint-disable-next-line no-console
            console.log(
              `[VehicleTracker] REJECT ${outcome.result.reason} acc=${fix.acc} spd=${fix.spd}`,
            );
          } else if (outcome.snap) {
            const tangent = Math.round(pointAt(table, outcome.snap.d).bearing);
            // eslint-disable-next-line no-console
            console.log(
              `[VehicleTracker] ${outcome.snap.status} d=${Math.round(
                outcome.snap.d,
              )} tangentBrg=${tangent} gpsBrg=${Math.round(fix.brg)} spd=${fix.spd.toFixed(1)}`,
            );
          }
        }
      }),
    [source, pushFix],
  );

  return (
    <>
      {showRoutePolylines && (
        <TrackedRoutePolylines
          table={table}
          dRender={vehicle.dRender}
          aheadColor={routeColors?.ahead}
          behindColor={routeColors?.behind}
        />
      )}
      <VehicleMarker
        lat={vehicle.lat}
        lng={vehicle.lng}
        bearing={vehicle.bearing}
        opacity={vehicle.opacity}
        hasFix={vehicle.hasFix}
      >
        {icon}
      </VehicleMarker>
    </>
  );
};

/**
 * The pre-pipeline baseline: marker coordinate set per incoming fix.
 * Deliberately unfiltered and unsmoothed — this is the fallback the
 * feature flag guarantees, not something to improve.
 */
const NaiveVehicle = ({
  source,
  icon,
}: {
  source: FixSource;
  icon?: React.ReactNode;
}) => {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const latest = useRef<LocationFix | null>(null);
  useEffect(
    () =>
      source((f) => {
        latest.current = f;
        setFix(f);
      }),
    [source],
  );
  if (!fix) return null;
  return (
    <Marker
      anchor={{ x: 0.5, y: 0.5 }}
      coordinate={{ latitude: fix.lat, longitude: fix.lng }}
      rotation={Number.isFinite(fix.brg) ? fix.brg : 0}
      flat
      tracksViewChanges={false}
    >
      {icon ?? <View style={styles.naiveDot} />}
    </Marker>
  );
};

const styles = StyleSheet.create({
  naiveDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1a365d",
    borderWidth: 3,
    borderColor: "#ffffff",
  },
});
