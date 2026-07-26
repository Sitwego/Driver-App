// ----------------------------------------------------------------
// Step 2 — Ingest gate.
//
// First stage of the pipeline: accepts raw LocationFix values and
// emits accepted ones. Bad input is DROPPED, never repaired — the
// render-delay buffer (Step 4) means a dropped fix costs nothing,
// while a repaired-wrong fix corrupts the motion model.
//
// Pure TS with no react-native imports; fully deterministic given
// the fix stream (time is read only from the fixes themselves).
// ----------------------------------------------------------------

import { computeDistanceBetween, normalizeHeading } from "./geo";
import type { LocationFix } from "./types";

export type RejectReason =
  | "invalid" // non-finite lat/lng/ts/seq/acc
  | "duplicate_seq" // seq not strictly increasing (dupes + out-of-order)
  | "poor_accuracy" // acc > maxAccuracyM
  | "ts_regression" // measured-time clock jumped backward
  | "teleport"; // implied speed vs last accepted fix impossible

/** An accepted fix, enriched with the gate's derived signals. */
export interface AcceptedFix extends LocationFix {
  /**
   * Exponentially smoothed speed, m/s. When the device speed is unusable
   * (NaN/negative), the implied speed from the last accepted fix feeds the
   * filter instead, so this is always finite and >= 0.
   */
  smoothedSpd: number;
  /**
   * Course-over-ground in [0, 360), or null when GPS bearing is garbage
   * (below minHeadingSpeedMps, or non-finite). While snapped to a route the
   * polyline tangent is the bearing authority anyway (Step 4).
   */
  heading: number | null;
}

export interface IngestResult {
  accepted: AcceptedFix | null;
  reason: RejectReason | null;
}

export interface IngestGateOptions {
  /** Fixes with worse horizontal accuracy than this are dropped. */
  maxAccuracyM?: number;
  /** Implied speed above this (m/s) is a teleport. ~150 km/h. */
  maxSpeedMps?: number;
  /** Tolerated backward jump of the measurement clock. */
  maxTsRegressionMs?: number;
  /** Below this speed GPS course-over-ground is discarded. */
  minHeadingSpeedMps?: number;
  /** EMA alpha for speed smoothing (1 = no smoothing). */
  speedSmoothingAlpha?: number;
}

const DEFAULTS: Required<IngestGateOptions> = {
  maxAccuracyM: 50,
  maxSpeedMps: 42,
  maxTsRegressionMs: 2000,
  minHeadingSpeedMps: 1.5,
  speedSmoothingAlpha: 0.4,
};

/**
 * Floor for the Δt used in the implied-speed (teleport) check. Fixes closer
 * together than this (or slightly out of chronological order but within the
 * ts-regression tolerance) are judged as if 250 ms apart, so a division by
 * ~zero can never launder a teleport through as "plausible".
 */
const MIN_IMPLIED_DT_S = 0.25;

export class IngestGate {
  private readonly opts: Required<IngestGateOptions>;
  private lastSeq = -Infinity;
  private lastAccepted: AcceptedFix | null = null;
  private smoothedSpd: number | null = null;

  constructor(options?: IngestGateOptions) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** Drops all state — call when the fix stream restarts (new trip/replay). */
  reset(): void {
    this.lastSeq = -Infinity;
    this.lastAccepted = null;
    this.smoothedSpd = null;
  }

  /** The most recent accepted fix, if any. */
  get last(): AcceptedFix | null {
    return this.lastAccepted;
  }

  push(fix: LocationFix): IngestResult {
    const o = this.opts;

    if (
      !Number.isFinite(fix.lat) ||
      !Number.isFinite(fix.lng) ||
      !Number.isFinite(fix.ts) ||
      !Number.isFinite(fix.seq) ||
      !Number.isFinite(fix.acc)
    ) {
      return reject("invalid");
    }

    // seq is the ordering authority: duplicates AND late (out-of-order)
    // deliveries both arrive with seq <= something already seen.
    if (fix.seq <= this.lastSeq) {
      return reject("duplicate_seq");
    }
    // A bad fix still consumes its seq — a later retransmit of the same seq
    // is a duplicate no matter why the first copy was dropped.
    this.lastSeq = fix.seq;

    if (fix.acc > o.maxAccuracyM) {
      return reject("poor_accuracy");
    }

    const last = this.lastAccepted;
    let impliedSpd: number | null = null;
    if (last) {
      if (fix.ts < last.ts - o.maxTsRegressionMs) {
        return reject("ts_regression");
      }

      const dtS = Math.max((fix.ts - last.ts) / 1000, MIN_IMPLIED_DT_S);
      const dist = computeDistanceBetween(
        { latitude: last.lat, longitude: last.lng },
        { latitude: fix.lat, longitude: fix.lng },
      );
      impliedSpd = dist / dtS;
      if (impliedSpd > o.maxSpeedMps) {
        return reject("teleport");
      }
    }

    // Speed: EMA over the device speed, falling back to the implied speed
    // when the device value is unusable (NaN / negative on cheap chips).
    const deviceSpdUsable = Number.isFinite(fix.spd) && fix.spd >= 0;
    const spdSample = deviceSpdUsable ? fix.spd : (impliedSpd ?? 0);
    this.smoothedSpd =
      this.smoothedSpd === null
        ? spdSample
        : o.speedSmoothingAlpha * spdSample +
          (1 - o.speedSmoothingAlpha) * this.smoothedSpd;

    const heading =
      Number.isFinite(fix.brg) && this.smoothedSpd >= o.minHeadingSpeedMps
        ? normalizeHeading(fix.brg)
        : null;

    const accepted: AcceptedFix = {
      ...fix,
      smoothedSpd: this.smoothedSpd,
      heading,
    };
    this.lastAccepted = accepted;
    return { accepted, reason: null };
  }
}

function reject(reason: RejectReason): IngestResult {
  return { accepted: null, reason };
}
