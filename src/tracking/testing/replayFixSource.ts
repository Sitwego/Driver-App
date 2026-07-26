// ----------------------------------------------------------------
// Replay FixSource — the mock half of the transport boundary.
//
// Re-emits a recorded/generated trace with its original relative
// timing (optionally time-compressed). Fixes are emitted with their
// ORIGINAL ts values: the gate and motion model reason about
// measurement time from the fixes themselves, so compressing the
// wall-clock replay must not alter the physics encoded in the data.
// (Wall-clock rebasing knobs arrive with the Step 6 harness.)
// ----------------------------------------------------------------

import type { FixSource, LocationFix, Unsubscribe } from "../types";

export interface ReplayOptions {
  /** Wall-clock speed multiplier: 4 = replay 4× faster. Default 1. */
  speed?: number;
  /** Restart from the beginning when the trace ends. Default false. */
  loop?: boolean;
  /** Called just before each restart (e.g. to reset the ingest gate). */
  onLoop?: () => void;
}

export function createReplayFixSource(
  trace: readonly LocationFix[],
  options: ReplayOptions = {},
): FixSource {
  const { speed = 1, loop = false, onLoop } = options;

  return (onFix) => {
    if (trace.length === 0) return () => {};

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let index = 0;

    const scheduleNext = () => {
      if (cancelled) return;

      if (index >= trace.length) {
        if (!loop) return;
        index = 0;
        onLoop?.();
      }

      const fix = trace[index];
      const prev = index > 0 ? trace[index - 1] : null;
      const delayMs = prev ? Math.max(0, (fix.ts - prev.ts) / speed) : 0;

      timer = setTimeout(() => {
        if (cancelled) return;
        index++;
        onFix({ ...fix });
        scheduleNext();
      }, delayMs);
    };

    scheduleNext();

    const unsubscribe: Unsubscribe = () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
    return unsubscribe;
  };
}
