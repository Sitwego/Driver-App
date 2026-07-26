// ----------------------------------------------------------------
// Step 5 — useTrackedVehicle: wires the pipeline to the UI.
//
// Threading model (the whole point of this hook):
//   • JS thread, per fix (~1 Hz): IngestGate → Snapper → geometry
//     provider (Nitro). Accepted snapped fixes are forwarded to the
//     UI thread with runOnUI.
//   • UI thread, per frame (60 Hz): a Reanimated useFrameCallback
//     advances the motion model (motionTick — pure worklet math, no
//     bridge crossing) and writes lat/lng/bearing/opacity into shared
//     values. VehicleMarker consumes them via useAnimatedProps, so no
//     React render happens per frame anywhere.
//   • Low-frequency UI state (chip/debug: dRender, stale, arrived,
//     delay) is published back to React via runOnJS only when the
//     10 m-quantized dRender or a flag actually changes.
//
// The motion model state object lives on the UI thread: it is placed
// into a shared value ONCE (deep-cloned across), and from then on it
// is only ever touched by UI-thread code (motionOnFix via runOnUI,
// motionTick in the frame callback).
// ----------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  runOnJS,
  runOnUI,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import {
  IngestGate,
  type AcceptedFix,
  type IngestGateOptions,
  type IngestResult,
} from "./ingestGate";
import { getGeometryProvider, type GeometryProvider } from "./mapsGeometry";
import {
  createMotionModel,
  motionOnFix,
  motionOnForeground,
  motionReset,
  motionTick,
  type MotionModelOptions,
  type MotionState,
} from "./motionModel";
import { Snapper, type SnapperOptions, type SnapResult } from "./snap";
import type { LocationFix, RouteTable } from "./types";

/** Replay clock mapping: dataNow = dataMs + (Date.now() - wallMs) * scale. */
interface ClockAnchor {
  wallMs: number;
  dataMs: number;
  scale: number;
}

/** Low-frequency state for chips/debug UIs — updated a few times per second. */
export interface TrackedVehicleUiState {
  dRenderM: number;
  delayMs: number;
  stale: boolean;
  arrived: boolean;
}

export interface UseTrackedVehicleOptions {
  table: RouteTable;
  /** Injected geometry provider; defaults to the runtime provider. */
  geometry?: GeometryProvider;
  gateOptions?: IngestGateOptions;
  snapperOptions?: SnapperOptions;
  motionOptions?: MotionModelOptions;
}

export interface PushFixOutcome {
  result: IngestResult;
  /** null when the fix was rejected by the gate. */
  snap: SnapResult | null;
}

export interface TrackedVehicle {
  /** Rendered position/heading — feed these to VehicleMarker. */
  lat: SharedValue<number>;
  lng: SharedValue<number>;
  bearing: SharedValue<number>;
  /** 1 while fresh; pulses ~0.35–0.55 while stale. */
  opacity: SharedValue<number>;
  /** Distance along route driving the polyline split (read at low freq). */
  dRender: SharedValue<number>;
  /** True once the first accepted fix has positioned the vehicle. */
  hasFix: SharedValue<boolean>;
  /** Low-frequency React state for chips/debug UIs. */
  ui: TrackedVehicleUiState;
  /** Push a raw fix through gate → snapper → motion model. JS thread. */
  pushFix: (fix: LocationFix) => PushFixOutcome;
  /**
   * Replay support: map the render clock onto a compressed data clock.
   * Call once when the first replayed fix arrives; omit for live data.
   */
  setReplayClock: (wallMs: number, dataMs: number, scale: number) => void;
  /** Full pipeline reset (new trip/leg/replay loop). */
  reset: () => void;
}

const INITIAL_UI: TrackedVehicleUiState = {
  dRenderM: 0,
  delayMs: 0,
  stale: false,
  arrived: false,
};

/**
 * Dev-build leak detector (Step 7): one entry per mounted hook, which
 * is 1:1 with registered frame callbacks. After navigating away from a
 * tracking screen this must drop back — the harness chip surfaces it.
 */
const devHookCounter = { active: 0 };

export function getActiveTrackedVehicleCount(): number {
  return devHookCounter.active;
}

/*
 * This hook is deliberately imperative: it drives Reanimated shared values
 * across effect / worklet / callback boundaries, which the React Compiler
 * static-analysis lint rules cannot model.
 *   • react-hooks/immutability — flags `sharedValue.value = …` as mutating a
 *     "frozen" value; that assignment is exactly Reanimated's contract.
 *   • react-hooks/set-state-in-effect — flags the intentional UI reset on a
 *     leg switch (the [table] effect below), which is a reset-on-prop-change.
 * Disabled file-wide because every hook here follows these patterns.
 */
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */

export function useTrackedVehicle(
  options: UseTrackedVehicleOptions,
): TrackedVehicle {
  // Also opt out of the babel React Compiler: it would silently bail on this
  // imperative hook anyway, and there is nothing here to memoize.
  "use no memo";

  const { table } = options;

  const lat = useSharedValue(0);
  const lng = useSharedValue(0);
  const bearing = useSharedValue(0);
  const opacity = useSharedValue(1);
  const dRender = useSharedValue(0);
  const hasFix = useSharedValue(false);
  /** Motion model state — UI-thread-owned after the initial clone. */
  const motion = useSharedValue<MotionState | null>(null);
  const clock = useSharedValue<ClockAnchor | null>(null);
  /** Change detector for the low-frequency publish (10 m quantized + flags). */
  const publishKey = useSharedValue("");

  const [ui, setUi] = useState<TrackedVehicleUiState>(INITIAL_UI);

  // JS-thread pipeline stages.
  const { gate, snapper } = useMemo(() => {
    const geometry = options.geometry ?? getGeometryProvider();
    return {
      gate: new IngestGate(options.gateOptions),
      snapper: new Snapper(table, { ...options.snapperOptions, geometry }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  /** Last accepted fix — re-projected on leg switches for continuity. */
  const lastAcceptedRef = useRef<AcceptedFix | null>(null);

  /** Reads the render clock (replay-mapped when a replay anchor is set). */
  const clockNow = useCallback(() => {
    const a = clock.value;
    const wall = Date.now();
    return a === null ? wall : a.dataMs + (wall - a.wallMs) * a.scale;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed the UI-thread motion state once per route table. On a LEG
  // SWITCH (new table mid-trip) this is the spec's reset: fresh
  // geometry, fresh monotonic clamp (the snapper memo above is new
  // too), and the vehicle's last known position re-projected on the
  // new route with a full-route search so the marker never jumps
  // backward — it re-acquires exactly where the vehicle physically is.
  const motionOptions = options.motionOptions;
  useEffect(() => {
    motion.value = createMotionModel(table, motionOptions);
    hasFix.value = false;
    publishKey.value = "";
    setUi(INITIAL_UI);
    const last = lastAcceptedRef.current;
    if (last) {
      const snap = snapper.push(last);
      if (snap.status === "snapped") {
        const d = snap.d;
        const now = clockNow();
        const ts = last.ts;
        const spd = last.smoothedSpd;
        runOnUI(() => {
          "worklet";
          const s = motion.value;
          if (s !== null) motionOnFix(s, d, ts, spd, now);
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  // Step 7: background → foreground discards the interpolation clock
  // and fast-forwards to the buffered truth (≤ fastForwardMs, eased) —
  // the backlog is never replayed in real time.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      runOnUI(() => {
        "worklet";
        const s = motion.value;
        if (s !== null) motionOnForeground(s);
      })();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev leak detector — see getActiveTrackedVehicleCount().
  useEffect(() => {
    devHookCounter.active += 1;
    return () => {
      devHookCounter.active -= 1;
    };
  }, []);

  const publishUi = useCallback(
    (dRenderM: number, delayMs: number, stale: boolean, arrived: boolean) => {
      setUi({ dRenderM, delayMs, stale, arrived });
    },
    [],
  );

  // 60 Hz: advance the model and refresh the shared values. No React.
  const frame = useFrameCallback(() => {
    "worklet";
    const s = motion.value;
    if (s === null || !s.hasFix) return;
    const wall = Date.now();
    const a = clock.value;
    const now = a === null ? wall : a.dataMs + (wall - a.wallMs) * a.scale;
    motionTick(s, now);
    lat.value = s.lat;
    lng.value = s.lng;
    bearing.value = s.bearing;
    dRender.value = s.dRender;
    hasFix.value = true;
    // Staleness UI: subtle pulse instead of a hard dim.
    opacity.value = s.stale ? 0.45 + 0.1 * Math.sin(wall / 250) : 1;

    const key =
      `${Math.floor(s.dRender / 10)}|${s.stale ? 1 : 0}|` +
      `${s.arrived ? 1 : 0}|${Math.round(s.delayMs / 100)}`;
    if (key !== publishKey.value) {
      publishKey.value = key;
      runOnJS(publishUi)(s.dRender, s.delayMs, s.stale, s.arrived);
    }
  }, true);
  // Referenced so linters know the callback's lifecycle is managed here.
  void frame;

  const pushFix = useCallback(
    (fix: LocationFix): PushFixOutcome => {
      const result = gate.push(fix);
      if (!result.accepted) return { result, snap: null };
      lastAcceptedRef.current = result.accepted;
      const snap = snapper.push(result.accepted);
      if (snap.status === "snapped") {
        const now = clockNow();
        const d = snap.d;
        const ts = result.accepted.ts;
        const spd = result.accepted.smoothedSpd;
        runOnUI(() => {
          "worklet";
          const s = motion.value;
          if (s !== null) motionOnFix(s, d, ts, spd, now);
        })();
      }
      return { result, snap };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gate, snapper],
  );

  const setReplayClock = useCallback(
    (wallMs: number, dataMs: number, scale: number) => {
      clock.value = { wallMs, dataMs, scale };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const reset = useCallback(() => {
    gate.reset();
    snapper.reset();
    lastAcceptedRef.current = null;
    clock.value = null;
    hasFix.value = false;
    publishKey.value = "";
    runOnUI(() => {
      "worklet";
      const s = motion.value;
      if (s !== null) motionReset(s);
    })();
    setUi(INITIAL_UI);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, snapper]);

  return {
    lat,
    lng,
    bearing,
    opacity,
    dRender,
    hasFix,
    ui,
    pushFix,
    setReplayClock,
    reset,
  };
}
