// ----------------------------------------------------------------
// Step 6 — fault-injection transforms for the replay harness.
//
// Takes a clean recorded/generated trace and returns a new trace with
// the toggled faults applied. Pure and deterministic (seeded LCG), so
// every QA reproduction is identical and the transforms unit-test.
//
// The transforms simulate DELIVERY faults (drops, reordering,
// duplicates, a network gap) and MEASUREMENT faults (an off-route
// detour, degraded accuracy). Windows are placed at fixed fractions
// of the trace so they never overlap:
//   gap 18–30% · detour 40–54% · accuracy degradation 64–78%.
// ----------------------------------------------------------------

import type { LocationFix } from "../types";

export interface HarnessFaults {
  /** Randomly drop ~20% of fixes (upstream loss). */
  dropFixes: boolean;
  /** Swap adjacent deliveries so a newer seq arrives first. */
  outOfOrder: boolean;
  /** Re-deliver an already-sent fix (same seq). */
  duplicateSeq: boolean;
  /** Remove all fixes in a 30 s window (network outage; vehicle keeps moving). */
  gap30s: boolean;
  /** Offset a stretch ~55 m off the route, then return (off-route → re-acquire). */
  detour: boolean;
  /** Degrade accuracy to 35–80 m with matching position noise for a stretch. */
  accuracyDegradation: boolean;
}

export const NO_FAULTS: HarnessFaults = {
  dropFixes: false,
  outOfOrder: false,
  duplicateSeq: false,
  gap30s: false,
  detour: false,
  accuracyDegradation: false,
};

/** ~1.11 m of latitude per meter. */
const DEG_PER_METER = 1 / 111_195;

/** Deterministic 32-bit LCG in [0, 1). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Applies the toggled faults to `clean` and returns a NEW trace.
 * Measurement faults first (they edit fixes in place), then the gap,
 * then delivery faults (they reorder/duplicate whatever survives).
 */
export function applyHarnessFaults(
  clean: readonly LocationFix[],
  faults: HarnessFaults,
  seed = 1234,
): LocationFix[] {
  const rand = lcg(seed);
  const t0 = clean[0]?.ts ?? 0;
  const span = clean.length > 0 ? clean[clean.length - 1].ts - t0 : 0;
  const frac = (fix: LocationFix) => (span > 0 ? (fix.ts - t0) / span : 0);

  let trace: LocationFix[] = clean.map((f) => ({ ...f }));

  if (faults.detour) {
    // Hard sideways offset ≈ 55 m (beyond even the 45 m boda threshold)
    // held for the whole window, then straight back on route — exactly
    // the Step 3 off-route → re-acquire acceptance scenario.
    for (const f of trace) {
      const p = frac(f);
      if (p >= 0.4 && p < 0.54) {
        f.lat += 50 * DEG_PER_METER;
        f.lng += 22 * DEG_PER_METER;
      }
    }
  }

  if (faults.accuracyDegradation) {
    for (const f of trace) {
      const p = frac(f);
      if (p >= 0.64 && p < 0.78) {
        // 35–80 m reported accuracy; > 50 m entries get gate-rejected.
        const acc = 35 + rand() * 45;
        f.acc = Math.round(acc);
        // Position noise scaled to the claimed accuracy (~0.5 σ).
        f.lat += (rand() - 0.5) * acc * DEG_PER_METER;
        f.lng += (rand() - 0.5) * acc * DEG_PER_METER;
      }
    }
  }

  if (faults.gap30s) {
    const gapStartTs = t0 + span * 0.18;
    trace = trace.filter((f) => f.ts < gapStartTs || f.ts >= gapStartTs + 30_000);
  }

  if (faults.dropFixes) {
    // Never drop the first two fixes — the harness should always acquire.
    trace = trace.filter((_, i) => i < 2 || rand() >= 0.2);
  }

  if (faults.duplicateSeq) {
    const out: LocationFix[] = [];
    trace.forEach((f, i) => {
      out.push(f);
      // Re-deliver roughly every 12th fix immediately after itself.
      if (i > 2 && i % 12 === 0) out.push({ ...f });
    });
    trace = out;
  }

  if (faults.outOfOrder) {
    // Swap delivery order of a pair roughly every 10 fixes: the newer
    // seq arrives first, the older one is late (gate drops it).
    for (let i = 3; i + 1 < trace.length; i += 10) {
      const tmp = trace[i];
      trace[i] = trace[i + 1];
      trace[i + 1] = tmp;
    }
  }

  return trace;
}
