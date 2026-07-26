// ----------------------------------------------------------------
// TrackingDemo — the Step 6 replay harness & dev screen.
//
// Replays the committed mock-route trace through the FULL pipeline
// via useTrackedVehicle at a selectable speed (1×/4×/16×), with
// toggles injecting delivery/measurement faults (drops, out-of-order,
// duplicate seq, 30 s gap, off-route detour, accuracy degradation —
// see testing/traceTransforms.ts). Rendering is the production path:
// a Reanimated useFrameCallback ticks the motion model on the UI
// thread and the marker is driven by animatedProps — zero per-frame
// React renders. Debug overlay on the demo's own map:
//   • raw fixes (red dots — includes rejected/corrupted deliveries)
//   • snapped positions (blue dots)
//   • the dRender vehicle (green arrow puck) via <VehicleMarker>
//   • traveled-route split polylines (dimmed behind / brand green ahead)
//   • status chip: state (tracking/stale/off-route/arrived), fix age,
//     accept/reject counts, adaptive delay, geometry provider
//
// Changing speed or any fault toggle REMOUNTS the demo (key bump) so
// gate/snapper/motion model/replay all restart from a clean state.
//
// The replay compresses wall time but keeps original fix `ts`, so the
// hook is given a replay clock anchored at the first fix.
//
// IMPORTANT: <TrackingDemo> renders MAP FEATURES ONLY (children of the
// MapView). Non-feature views inside react-native-maps children crash
// Fabric mounting on Android. The status chip lives in
// <TrackingDemoChip>, outside the map, fed by a module-level store.
//
// Mount once in MapScreen: `{__DEV__ && <TrackingDemoOverlay />}` —
// the demo runs on its OWN map (own ref), so the production map's
// camera logic never fights it; the camera glides after the vehicle.
// ----------------------------------------------------------------

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Circle } from "react-native-maps";

import RnMapView from "~/components/RnMaps/RnMapView";

import { TrackedRoutePolylines, VehicleMarker } from "../VehicleMarker";
import { getGeometryProvider, type GeometryProvider } from "../mapsGeometry";
import { prepareRouteTS, projectOnPathTS } from "../routeGeometry";
import trace from "../testing/fixtures/mock-route-trace.json";
import { MOCK_ROUTE_ENCODED, MOCK_ROUTE_POINTS } from "../testing/mockRoute";
import { createReplayFixSource } from "../testing/replayFixSource";
import {
  applyHarnessFaults,
  NO_FAULTS,
  type HarnessFaults,
} from "../testing/traceTransforms";
import {
  getActiveTrackedVehicleCount,
  useTrackedVehicle,
} from "../useTrackedVehicle";

import type { RejectReason } from "../ingestGate";
import type { SnapStatus } from "../snap";


import type { LocationFix } from "../types";
import type MapView from "react-native-maps";

const MAX_DOTS = 80;
/** Camera-follow cadence; duration matches so the glide is continuous. */
const FOLLOW_MS = 2500;

const SPEEDS = [1, 4, 16] as const;

interface Dot {
  key: number;
  lat: number;
  lng: number;
}

// ---- chip store: lets the status chip live OUTSIDE the map view ----

interface ChipData {
  active: boolean;
  providerKind: string;
  routeLengthM: number;
  delayMs: number;
  accepted: number;
  rejected: number;
  lastReason: RejectReason | null;
  snapStatus: SnapStatus;
  dRenderM: number;
  stale: boolean;
  arrived: boolean;
  spd: number | null;
  /** Wall time of the last ACCEPTED fix — drives the "fix age" readout. */
  lastFixWallMs: number | null;
  error: string | null;
}

let chipData: ChipData = {
  active: false,
  providerKind: "?",
  routeLengthM: 0,
  delayMs: 0,
  accepted: 0,
  rejected: 0,
  lastReason: null,
  snapStatus: "snapped",
  dRenderM: 0,
  stale: false,
  arrived: false,
  spd: null,
  lastFixWallMs: null,
  error: null,
};
const chipListeners = new Set<() => void>();

function publishChip(patch: Partial<ChipData>): void {
  chipData = { ...chipData, ...patch };
  chipListeners.forEach((l) => l());
}

const subscribeChip = (cb: () => void) => {
  chipListeners.add(cb);
  return () => {
    chipListeners.delete(cb);
  };
};

/** Logs a pipeline error once and surfaces it on the chip. */
function reportDemoError(where: string, e: unknown): void {
  const err = e as Error;

  console.error(`[TrackingDemo] ${where}: ${err?.message}`, err?.stack);
  publishChip({ error: `${where}: ${err?.message}` });
}

interface TrackingDemoProps {
  /** The demo map's own ref — used for the camera follow. */
  mapRef?: React.RefObject<MapView | null>;
  /** Replay wall-clock multiplier (1×/4×/16×). */
  speed?: number;
  /** Fault-injection toggles (see traceTransforms.ts). */
  faults?: HarnessFaults;
}

const TrackingDemoComponent = ({
  mapRef,
  speed = 4,
  faults = NO_FAULTS,
}: TrackingDemoProps) => {
  const [rawDots, setRawDots] = useState<Dot[]>([]);
  const [snapDots, setSnapDots] = useState<Dot[]>([]);
  const totals = useRef({ accepted: 0, rejected: 0 });
  const clockArmed = useRef(false);

  // The harness remounts this component when speed/faults change, so
  // the transformed trace is stable for the component's lifetime.
  const harnessTrace = useMemo(
    () => applyHarnessFaults(trace as LocationFix[], faults),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // prepareRoute goes through the provider on purpose: on-device this
  // exercises the MapsGeometry Nitro module end-to-end. If the native
  // path throws, fall back to the TS mirror and surface the error on
  // the chip instead of taking the screen down.
  const { table, providerKind, provider } = useMemo(() => {
    let p: GeometryProvider = getGeometryProvider();
    let prepared: ReturnType<GeometryProvider["prepareRoute"]>;
    try {
      prepared = p.prepareRoute(MOCK_ROUTE_ENCODED);
    } catch (e) {
      reportDemoError(`prepareRoute (${p.kind})`, e);
      p = {
        kind: "ts",
        prepareRoute: prepareRouteTS,
        projectOnPath: projectOnPathTS,
      };
      prepared = p.prepareRoute(MOCK_ROUTE_ENCODED);
    }
    return { table: prepared, providerKind: p.kind, provider: p };
  }, []);

  const vehicle = useTrackedVehicle({ table, geometry: provider });
  const { ui } = vehicle;

  // Low-frequency chip refresh from the hook's UI state.
  useEffect(() => {
    publishChip({
      dRenderM: ui.dRenderM,
      delayMs: ui.delayMs,
      stale: ui.stale,
      arrived: ui.arrived,
    });
  }, [ui]);

  useEffect(() => {
    publishChip({
      active: true,
      providerKind,
      routeLengthM: table.totalLength,
    });

    const source = createReplayFixSource(harnessTrace, {
      speed,
      loop: true,
      onLoop: () => {
        vehicle.reset();
        clockArmed.current = false;
        totals.current = { accepted: 0, rejected: 0 };
        setRawDots([]);
        setSnapDots([]);
      },
    });

    // Per fix (low frequency): gate → snapper → runOnUI motion update
    // inside pushFix; the dots/chip setState here is low-frequency.
    let dotKey = 0;
    const unsubscribe = source((fix) => {
      try {
        if (!clockArmed.current) {
          clockArmed.current = true;
          vehicle.setReplayClock(Date.now(), fix.ts, speed);
        }
        // Every delivery — including corrupted/rejected ones — is a raw
        // red dot. Keys are per-delivery: duplicates share a seq.
        const key = dotKey++;
        setRawDots((prev) => [
          ...prev.slice(-(MAX_DOTS - 1)),
          { key, lat: fix.lat, lng: fix.lng },
        ]);
        const { result, snap } = vehicle.pushFix(fix);
        if (result.accepted) {
          totals.current.accepted++;
          setSnapDots((prev) => [
            ...prev.slice(-(MAX_DOTS - 1)),
            { key, lat: snap!.lat, lng: snap!.lng },
          ]);
          publishChip({
            accepted: totals.current.accepted,
            snapStatus: snap!.status,
            spd: result.accepted.smoothedSpd,
            lastFixWallMs: Date.now(),
          });
        } else {
          totals.current.rejected++;
          publishChip({
            rejected: totals.current.rejected,
            lastReason: result.reason,
          });
        }
      } catch (e) {
        reportDemoError("fix pipeline", e);
      }
    });

    // Continuous camera follow: chained equal-duration glides to the
    // vehicle's current position. The demo owns this map, so nothing
    // else moves the camera.
    const follow = setInterval(() => {
      if (!vehicle.hasFix.value) return;
      try {
        mapRef?.current?.animateCamera(
          {
            center: {
              latitude: vehicle.lat.value,
              longitude: vehicle.lng.value,
            },
            zoom: 15.5,
          },
          { duration: FOLLOW_MS },
        );
      } catch {
        // camera follow is best-effort
      }
    }, FOLLOW_MS);

    return () => {
      unsubscribe();
      clearInterval(follow);
      publishChip({ active: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <TrackedRoutePolylines table={table} dRender={vehicle.dRender} />
      {/* Debug overlay: raw deliveries (red) vs snapped positions (blue);
          the dRender vehicle is the green puck below. */}
      {rawDots.map((d) => (
        <Circle
          key={`raw-${d.key}`}
          center={{ latitude: d.lat, longitude: d.lng }}
          radius={4}
          strokeWidth={0}
          fillColor="rgba(197, 48, 48, 0.85)"
        />
      ))}
      {snapDots.map((d) => (
        <Circle
          key={`snap-${d.key}`}
          center={{ latitude: d.lat, longitude: d.lng }}
          radius={3}
          strokeWidth={0}
          fillColor="rgba(43, 108, 176, 0.95)"
        />
      ))}
      <VehicleMarker
        lat={vehicle.lat}
        lng={vehicle.lng}
        bearing={vehicle.bearing}
        opacity={vehicle.opacity}
        hasFix={vehicle.hasFix}
      />
    </>
  );
};

export const TrackingDemo = React.memo(TrackingDemoComponent);

/**
 * Full-screen dev overlay hosting the demo on its OWN map, so the
 * production map's camera logic (driver-location recentering) and the
 * demo never fight. Collapsed to a small pill when closed.
 * Mount once in MapScreen: `{__DEV__ && <TrackingDemoOverlay />}`.
 */
export const TrackingDemoOverlay = () => {
  const [open, setOpen] = useState(true);
  const [speed, setSpeed] = useState<number>(4);
  const [faults, setFaults] = useState<HarnessFaults>(NO_FAULTS);
  const [nonce, setNonce] = useState(0);
  const demoMapRef = useRef<MapView | null>(null);

  if (!open) {
    return (
      <Pressable style={styles.openButton} onPress={() => setOpen(true)}>
        <Text style={styles.openButtonText}>tracking demo</Text>
      </Pressable>
    );
  }

  const toggleFault = (k: keyof HarnessFaults) =>
    setFaults((f) => ({ ...f, [k]: !f[k] }));
  // Any config change remounts the demo: fresh gate/snapper/motion/replay.
  const configKey = `${speed}|${nonce}|${Object.values(faults).join(",")}`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <RnMapView
        ref={demoMapRef}
        style={StyleSheet.absoluteFill}
        initialCamera={{
          center: {
            latitude: MOCK_ROUTE_POINTS[0].latitude,
            longitude: MOCK_ROUTE_POINTS[0].longitude,
          },
          zoom: 15.5,
          pitch: 0,
          heading: 0,
          altitude: 0,
        }}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <TrackingDemo
          key={configKey}
          mapRef={demoMapRef}
          speed={speed}
          faults={faults}
        />
      </RnMapView>
      <TrackingDemoChip />
      <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          {SPEEDS.map((s) => (
            <HarnessButton
              key={s}
              label={`${s}×`}
              active={speed === s}
              onPress={() => setSpeed(s)}
            />
          ))}
          <HarnessButton
            label="restart"
            active={false}
            onPress={() => setNonce((n) => n + 1)}
          />
        </View>
        <View style={styles.controlRow}>
          <HarnessButton
            label="drops"
            active={faults.dropFixes}
            onPress={() => toggleFault("dropFixes")}
          />
          <HarnessButton
            label="dup seq"
            active={faults.duplicateSeq}
            onPress={() => toggleFault("duplicateSeq")}
          />
          <HarnessButton
            label="out-of-order"
            active={faults.outOfOrder}
            onPress={() => toggleFault("outOfOrder")}
          />
        </View>
        <View style={styles.controlRow}>
          <HarnessButton
            label="30s gap"
            active={faults.gap30s}
            onPress={() => toggleFault("gap30s")}
          />
          <HarnessButton
            label="detour"
            active={faults.detour}
            onPress={() => toggleFault("detour")}
          />
          <HarnessButton
            label="bad acc"
            active={faults.accuracyDegradation}
            onPress={() => toggleFault("accuracyDegradation")}
          />
        </View>
      </View>
    </View>
  );
};

const HarnessButton = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    style={[styles.harnessButton, active && styles.harnessButtonActive]}
    onPress={onPress}
  >
    <Text
      style={[
        styles.harnessButtonText,
        active && styles.harnessButtonTextActive,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

/**
 * Status chip — render OUTSIDE the map view (sibling overlay), never
 * as a MapView child (non-feature children crash Fabric mounting).
 */
export const TrackingDemoChip = () => {
  const data = useSyncExternalStore(subscribeChip, () => chipData);
  // 1 Hz re-render so the fix-age readout ticks between fixes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!data.active) return null;

  const state = data.arrived
    ? "arrived"
    : data.snapStatus === "off_route"
      ? "OFF-ROUTE"
      : data.stale
        ? "STALE"
        : "tracking";
  const ageS =
    data.lastFixWallMs === null
      ? null
      : Math.max(0, (Date.now() - data.lastFixWallMs) / 1000);

  return (
    <View style={styles.chip} pointerEvents="none">
      <Text style={styles.chipTitle}>tracking harness · step 6</Text>
      <Text style={styles.chipLine}>
        geometry: {data.providerKind} · route {Math.round(data.routeLengthM)} m
        · delay {(data.delayMs / 1000).toFixed(1)} s
      </Text>
      <Text style={styles.chipLine}>
        accepted {data.accepted} · rejected {data.rejected}
        {data.lastReason ? ` (last: ${data.lastReason})` : ""}
      </Text>
      <Text style={styles.chipLine}>
        {state} · d {Math.round(data.dRenderM)} m · spd{" "}
        {data.spd != null ? data.spd.toFixed(1) : "–"} m/s · fix age{" "}
        {ageS != null ? `${ageS.toFixed(0)} s` : "–"} · hooks{" "}
        {getActiveTrackedVehicleCount()}
      </Text>
      {data.error ? (
        <Text style={[styles.chipLine, styles.chipError]}>{data.error}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  controls: {
    position: "absolute",
    bottom: 96,
    left: 12,
    right: 12,
    backgroundColor: "rgba(20, 20, 28, 0.85)",
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  controlRow: {
    flexDirection: "row",
    gap: 6,
  },
  harnessButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  harnessButtonActive: {
    backgroundColor: "#6b9f77",
  },
  harnessButtonText: {
    color: "#cbd5e0",
    fontSize: 12,
    fontWeight: "600",
  },
  harnessButtonTextActive: {
    color: "#0f1a13",
  },
  chip: {
    position: "absolute",
    top: 110,
    left: 12,
    backgroundColor: "rgba(20, 20, 28, 0.78)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipTitle: {
    color: "#9ae6b4",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  chipLine: {
    color: "#e2e8f0",
    fontSize: 11,
  },
  chipError: {
    color: "#feb2b2",
  },
  openButton: {
    position: "absolute",
    bottom: 120,
    left: 12,
    backgroundColor: "rgba(20, 20, 28, 0.85)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  openButtonText: {
    color: "#9ae6b4",
    fontSize: 12,
    fontWeight: "700",
  },
  closeButton: {
    position: "absolute",
    top: 116,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(20, 20, 28, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
});
