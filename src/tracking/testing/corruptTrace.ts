// ----------------------------------------------------------------
// Injects labeled corruption into a clean fix trace, for asserting
// that the ingest gate rejects exactly the corrupted entries (Step 2)
// and for the replay harness toggles (Step 6).
// ----------------------------------------------------------------

import type { LocationFix } from "../types";

export type CorruptionKind =
  | "duplicate" // exact re-delivery of an earlier fix (same seq)
  | "out_of_order" // stale fix delivered late (older seq + ts)
  | "teleport" // plausible seq/ts but position jumped ~1 km sideways
  | "backward_ts" // measurement clock jumped back > 2 s
  | "poor_accuracy"; // acc way above the 50 m gate

export interface CorruptedTraceEntry {
  fix: LocationFix;
  /** null = original clean fix; otherwise the corruption injected. */
  corruption: CorruptionKind | null;
}

/**
 * Returns the clean trace interleaved with one injected corruption of each
 * requested kind. Injection points are deterministic (spread through the
 * middle of the trace) so tests are stable.
 *
 * The injected entries are constructed so that ONLY they are invalid: a
 * teleport is judged against the previous clean fix, and the clean fix after
 * it must still be accepted.
 */
export function corruptTrace(
  clean: readonly LocationFix[],
  kinds: readonly CorruptionKind[] = [
    "duplicate",
    "out_of_order",
    "teleport",
    "backward_ts",
    "poor_accuracy",
  ],
): CorruptedTraceEntry[] {
  if (clean.length < 20) {
    throw new Error("corruptTrace: need at least 20 clean fixes");
  }

  const entries: CorruptedTraceEntry[] = clean.map((fix) => ({
    fix,
    corruption: null,
  }));

  // Deterministic, well-separated insertion points (after these indices).
  const step = Math.floor(clean.length / (kinds.length + 1));

  kinds.forEach((kind, k) => {
    const at = step * (k + 1);
    const prev = clean[at];
    let fix: LocationFix;
    switch (kind) {
      case "duplicate":
        fix = { ...prev };
        break;
      case "out_of_order":
        fix = { ...clean[at - 3] };
        break;
      case "teleport":
        fix = {
          ...prev,
          seq: prev.seq + 0.5, // between prev and next, still increasing
          ts: prev.ts + 1000,
          lat: prev.lat + 0.009, // ~1 km north in 1 s
        };
        break;
      case "backward_ts":
        fix = {
          ...prev,
          seq: prev.seq + 0.5,
          ts: prev.ts - 10_000,
        };
        break;
      case "poor_accuracy":
        fix = {
          ...prev,
          seq: prev.seq + 0.5,
          ts: prev.ts + 500,
          acc: 80,
        };
        break;
    }
    // Insert right after its anchor, located by identity so earlier
    // insertions shifting the array don't matter.
    entries.splice(entries.findIndex((e) => e.fix === prev) + 1, 0, {
      fix,
      corruption: kind,
    });
  });

  return entries;
}
