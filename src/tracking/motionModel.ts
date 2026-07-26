// ----------------------------------------------------------------
// Step 4 — Motion model: the heart of the feature.
//
// Consumes snapped fixes (d along route + measurement ts + speed)
// and, on a per-frame `motionTick(nowMs)`, produces the rendered
// vehicle state: dRender / lat / lng / bearing / stale / arrived.
//
// Core ideas:
//   • Render delay: the vehicle is drawn `delayMs` in the past
//     (adaptive: 2× the median inter-fix arrival gap, clamped
//     1.5–5 s), so the model is almost always INTERPOLATING between
//     two known snapped positions instead of guessing.
//   • dRender never decreases. Ever. Behind the target it catches up
//     at ≤ 1.5× the modeled speed; ahead of it (over-extrapolated)
//     it freezes until reality catches up.
//   • No fix for 15 s → speed decays to 0 over 3 s and `stale` is
//     raised. When fixes resume, dRender fast-forwards to the target
//     with one eased animation capped at 1.5 s regardless of gap size.
//   • Bearing comes from the route tangent at dRender, slerped over
//     ~300 ms along the shortest arc (359°→1° never spins the long way).
//
// Pure TS with injected time — no Reanimated imports — so it tests
// deterministically. Deliberately written as plain-data state + free
// functions (not a class): Step 5 runs `motionTick` inside a
// Reanimated worklet, and captured class instances don't survive the
// worklet boundary while POJOs + "worklet" functions do.
// `motionTick` allocates nothing.
// ----------------------------------------------------------------

import { clamp, normalizeHeading, shortestHeadingDelta } from "./geo";
import { pointAtInto } from "./routeGeometry";

import type { RoutePoint, RouteTable } from "./types";

export interface MotionModelOptions {
  /** Initial render delay until enough gaps are observed to adapt. */
  initialDelayMs?: number;
  /** Adaptive delay = delayGapFactor × median inter-fix gap … */
  delayGapFactor?: number;
  /** … clamped to [minDelayMs, maxDelayMs]. */
  minDelayMs?: number;
  maxDelayMs?: number;
  /** No accepted fix for this long → stale. */
  staleAfterMs?: number;
  /** Once stale, rendered speed decays to 0 over this long. */
  speedDecayMs?: number;
  /** Cap for the eased fast-forward after a gap, regardless of gap size. */
  fastForwardMs?: number;
  /** Catch-up speed ceiling as a multiple of the modeled speed. */
  maxCatchupFactor?: number;
  /** Time constant (s) of catch-up convergence toward the target. */
  convergeTauS?: number;
  /** Bearing slerp duration. */
  bearingSlerpMs?: number;
  /** Below this modeled speed the marker must not creep (GPS wander). */
  minMoveSpeedMps?: number;
  /** Ticks longer than this (app pause etc.) are clamped — Step 7 handles fg/bg. */
  maxTickDtS?: number;
}

const DEFAULTS: Required<MotionModelOptions> = {
  initialDelayMs: 3000,
  delayGapFactor: 2,
  minDelayMs: 1500,
  maxDelayMs: 5000,
  staleAfterMs: 15_000,
  speedDecayMs: 3000,
  fastForwardMs: 1500,
  maxCatchupFactor: 1.5,
  convergeTauS: 2,
  bearingSlerpMs: 300,
  minMoveSpeedMps: 0.5,
  maxTickDtS: 0.25,
};

/** Rolling window of inter-arrival gaps feeding the adaptive delay. */
const GAP_WINDOW = 8;
/** Gaps observed before the delay starts adapting. */
const MIN_GAPS_TO_ADAPT = 3;
/** Snapped-sample buffer cap — 32 samples at 1–5 s cadence ≫ maxDelayMs. */
const BUFFER_CAP = 32;

export interface MotionState {
  readonly table: RouteTable;
  readonly o: Required<MotionModelOptions>;

  // Snapped-sample buffer (parallel arrays; ts strictly increasing,
  // d non-decreasing). spd is NaN when the device speed was unusable.
  bufTs: number[];
  bufD: number[];
  bufSpd: number[];

  // Arrival tracking (render/wall clock, NOT measurement ts).
  lastArrivalMs: number;
  gaps: number[];
  delayMs: number;

  // Render state.
  hasFix: boolean;
  lastTickMs: number;
  dRender: number;
  /** Rendered speed of the last tick, m/s (diagnostic + decay state). */
  vRender: number;
  bearing: number;
  bearingSet: boolean;
  stale: boolean;
  staleStartMs: number;
  vAtStale: number;
  ffPending: boolean;
  ffActive: boolean;
  ffFrom: number;
  ffTo: number;
  ffStartMs: number;
  arrived: boolean;

  // Outputs of the last tick.
  lat: number;
  lng: number;

  /** Scratch for pointAtInto — keeps the tick allocation-free. */
  pt: RoutePoint;
}

export function createMotionModel(
  table: RouteTable,
  options: MotionModelOptions = {},
): MotionState {
  const o = { ...DEFAULTS, ...options };
  return {
    table,
    o,
    bufTs: [],
    bufD: [],
    bufSpd: [],
    lastArrivalMs: -1,
    gaps: [],
    delayMs: o.initialDelayMs,
    hasFix: false,
    lastTickMs: -1,
    dRender: 0,
    vRender: 0,
    bearing: 0,
    bearingSet: false,
    stale: false,
    staleStartMs: 0,
    vAtStale: 0,
    ffPending: false,
    ffActive: false,
    ffFrom: 0,
    ffTo: 0,
    ffStartMs: 0,
    arrived: false,
    lat: 0,
    lng: 0,
    pt: { lat: 0, lng: 0, bearing: 0 },
  };
}

// Helpers must stay ABOVE their worklet callers: the Reanimated babel
// plugin rewrites "worklet" function declarations into `var x = …`
// assignments and captures same-module helpers into the caller's
// closure at module-init time — declared-later helpers are captured as
// `undefined`. Jest doesn't run that plugin; only the device fails.

function median(values: readonly number[]): number {
  "worklet";
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Modeled speed at buffer index i: device speed, else local slope. */
function modeledSpeedAt(state: MotionState, i: number): number {
  "worklet";
  const spd = state.bufSpd[i];
  if (Number.isFinite(spd)) return spd;
  if (i > 0) {
    const dtS = (state.bufTs[i] - state.bufTs[i - 1]) / 1000;
    if (dtS > 0) return (state.bufD[i] - state.bufD[i - 1]) / dtS;
  }
  return 0;
}

/** Back to the pre-first-fix state (new trip/leg/replay). Options and route stay. */
export function motionReset(state: MotionState): void {
  "worklet";
  state.bufTs.length = 0;
  state.bufD.length = 0;
  state.bufSpd.length = 0;
  state.lastArrivalMs = -1;
  state.gaps.length = 0;
  state.delayMs = state.o.initialDelayMs;
  state.hasFix = false;
  state.lastTickMs = -1;
  state.dRender = 0;
  state.vRender = 0;
  state.bearingSet = false;
  state.stale = false;
  state.ffPending = false;
  state.ffActive = false;
  state.arrived = false;
}

/**
 * Call when the app returns to the foreground (Step 7). Discards the
 * interpolation state's notion of "now" (the next tick starts with
 * Δt = 0 instead of a huge backlogged delta) and arms ONE capped,
 * eased fast-forward to wherever the buffered fixes say the vehicle
 * is — the backlog is never replayed in real time. If nothing arrived
 * while backgrounded, the existing staleness machinery takes over
 * (decay now, fast-forward on the next fix).
 */
export function motionOnForeground(state: MotionState): void {
  "worklet";
  state.lastTickMs = -1;
  if (!state.hasFix) return;
  state.ffActive = false; // re-target any in-flight fast-forward
  state.ffPending = true;
}

/**
 * Feeds one snapped fix.
 *
 * @param d     Snapped distance along the route (Snapper output).
 * @param ts    Measurement time of the fix (device epoch ms).
 * @param spd   Smoothed device speed, m/s — NaN when unusable; the model
 *              then derives speed from consecutive snapped fixes.
 * @param nowMs The render clock at arrival — same clock `motionTick` gets.
 */
export function motionOnFix(
  state: MotionState,
  d: number,
  ts: number,
  spd: number,
  nowMs: number,
): void {
  "worklet";
  const o = state.o;

  // Adaptive render delay from inter-ARRIVAL gaps (delivery cadence is
  // what the buffer must absorb, not measurement spacing).
  if (state.lastArrivalMs >= 0) {
    const gap = nowMs - state.lastArrivalMs;
    if (gap > 0) {
      state.gaps.push(gap);
      if (state.gaps.length > GAP_WINDOW) state.gaps.shift();
      if (state.gaps.length >= MIN_GAPS_TO_ADAPT) {
        state.delayMs = clamp(
          o.delayGapFactor * median(state.gaps),
          o.minDelayMs,
          o.maxDelayMs,
        );
      }
    }
  }
  state.lastArrivalMs = nowMs;

  // Resuming after a stale gap → one capped, eased fast-forward
  // (armed here, executed by the next tick where the render clock lives).
  if (state.stale) {
    state.stale = false;
    state.ffPending = true;
  }

  const n = state.bufTs.length;
  let tsIns = ts;
  let dIns = d;
  if (n > 0) {
    // The gate allows small ts regressions; interpolation needs strictly
    // increasing ts.
    if (tsIns <= state.bufTs[n - 1]) tsIns = state.bufTs[n - 1] + 1;
    // A sample behind the last one (off-route re-acquire behind the frozen
    // d) is held at the previous d: dRender never decreases, so the model
    // freezes until the vehicle re-passes that point (see NOTES.md).
    if (dIns < state.bufD[n - 1]) dIns = state.bufD[n - 1];
  } else {
    // First fix: place the vehicle immediately, no animation.
    state.dRender = dIns;
    state.hasFix = true;
  }
  state.bufTs.push(tsIns);
  state.bufD.push(dIns);
  state.bufSpd.push(Number.isFinite(spd) && spd >= 0 ? spd : NaN);
  if (state.bufTs.length > BUFFER_CAP) {
    state.bufTs.shift();
    state.bufD.shift();
    state.bufSpd.shift();
  }
}

/**
 * Advances the model to `nowMs` and refreshes the rendered outputs
 * (dRender / lat / lng / bearing / stale / arrived). Call at frame
 * rate; allocates nothing; returns `state` for convenience.
 */
export function motionTick(state: MotionState, nowMs: number): MotionState {
  "worklet";
  const o = state.o;
  const dtS =
    state.lastTickMs < 0
      ? 0
      : clamp((nowMs - state.lastTickMs) / 1000, 0, o.maxTickDtS);
  state.lastTickMs = nowMs;
  if (!state.hasFix || state.arrived) return state;

  // ---- target on the delayed render clock ----
  const renderTs = nowMs - state.delayMs;
  const n = state.bufTs.length;
  const bufTs = state.bufTs;
  const bufD = state.bufD;
  let dTarget: number;
  let vTarget: number;
  if (renderTs <= bufTs[0]) {
    dTarget = bufD[0];
    vTarget = 0;
  } else if (renderTs >= bufTs[n - 1]) {
    // Past the newest sample: dead-reckon at the modeled speed — device
    // speed when usable, else the slope of the last two snapped fixes.
    vTarget = modeledSpeedAt(state, n - 1);
    dTarget = bufD[n - 1] + (vTarget * (renderTs - bufTs[n - 1])) / 1000;
  } else {
    // The normal case the render delay buys: interpolate between two
    // known snapped positions.
    let i = n - 2;
    while (i > 0 && bufTs[i] > renderTs) i--;
    const segDtS = (bufTs[i + 1] - bufTs[i]) / 1000;
    vTarget = segDtS > 0 ? (bufD[i + 1] - bufD[i]) / segDtS : 0;
    dTarget = bufD[i] + (vTarget * (renderTs - bufTs[i])) / 1000;
  }
  // Stationary clamp: GPS wander at a pickup must not creep the marker.
  if (vTarget < o.minMoveSpeedMps) vTarget = 0;

  // ---- advance dRender (monotonic, always) ----
  const sinceFixMs = nowMs - state.lastArrivalMs;
  if (sinceFixMs > o.staleAfterMs) {
    // Stale: decay the rendered speed to 0 — the vehicle appears to stop.
    if (!state.stale) {
      state.stale = true;
      state.staleStartMs = nowMs;
      state.vAtStale = state.vRender;
    }
    const p = (nowMs - state.staleStartMs) / o.speedDecayMs;
    state.vRender = p >= 1 ? 0 : state.vAtStale * (1 - p);
    state.dRender += state.vRender * dtS;
  } else if (state.ffPending || state.ffActive) {
    if (state.ffPending) {
      state.ffPending = false;
      if (dTarget > state.dRender) {
        state.ffActive = true;
        state.ffFrom = state.dRender;
        state.ffTo = dTarget;
        state.ffStartMs = nowMs;
      }
      // Target at or behind dRender: nothing to fast-forward — the normal
      // freeze-until-caught-up path takes over next tick.
    }
    if (state.ffActive) {
      const p = clamp((nowMs - state.ffStartMs) / o.fastForwardMs, 0, 1);
      const eased = 1 - (1 - p) * (1 - p) * (1 - p);
      const dNew = state.ffFrom + (state.ffTo - state.ffFrom) * eased;
      if (dNew > state.dRender) state.dRender = dNew;
      state.vRender = vTarget;
      if (p >= 1) state.ffActive = false;
    }
  } else {
    const err = dTarget - state.dRender;
    if (err <= 0) {
      // Over-extrapolated: freeze until reality catches up. Never back up.
      state.vRender = 0;
    } else {
      // Converge at the modeled speed plus an error-proportional boost,
      // capped at maxCatchupFactor × the modeled speed — never a jump.
      state.vRender = Math.min(
        vTarget + err / o.convergeTauS,
        vTarget * o.maxCatchupFactor,
      );
      const candidate = state.dRender + state.vRender * dtS;
      state.dRender = candidate > dTarget ? dTarget : candidate;
    }
  }

  // ---- arrival: pin to the destination ----
  if (state.dRender >= state.table.totalLength) {
    state.dRender = state.table.totalLength;
    state.vRender = 0;
    state.arrived = true;
  }

  // ---- outputs: position + slerped bearing ----
  pointAtInto(state.table, state.dRender, state.pt);
  state.lat = state.pt.lat;
  state.lng = state.pt.lng;
  const target = state.pt.bearing;
  if (!state.bearingSet) {
    state.bearing = target;
    state.bearingSet = true;
  } else {
    const delta = shortestHeadingDelta(state.bearing, target);
    const f = Math.min((dtS * 1000) / o.bearingSlerpMs, 1);
    state.bearing = normalizeHeading(state.bearing + delta * f);
  }
  return state;
}
