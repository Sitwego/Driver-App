import { describe, expect, it, jest } from "@jest/globals";

import { IngestGate, type RejectReason } from "../ingestGate";
import type { LocationFix } from "../types";
import { corruptTrace } from "../testing/corruptTrace";
import { createReplayFixSource } from "../testing/replayFixSource";
import trace from "../testing/fixtures/nairobi-sim-trace.json";

const realTrace = trace as LocationFix[];

/** ~1.11 m of latitude. */
const DEG_PER_METER_LAT = 1 / 111_195;

function fix(overrides: Partial<LocationFix> = {}): LocationFix {
  return {
    seq: 1,
    ts: 1_760_000_000_000,
    lat: -1.3,
    lng: 36.8,
    acc: 10,
    spd: 5,
    brg: 90,
    ...overrides,
  };
}

describe("IngestGate rules (table-driven)", () => {
  interface Case {
    name: string;
    fixes: LocationFix[];
    // Expected outcome per fix: null = accepted, otherwise reject reason.
    expected: (RejectReason | null)[];
  }

  const cases: Case[] = [
    {
      name: "accepts a clean sequence",
      fixes: [
        fix({ seq: 1 }),
        fix({ seq: 2, ts: 1_760_000_001_000, lat: -1.29995 }),
        fix({ seq: 3, ts: 1_760_000_002_000, lat: -1.2999 }),
      ],
      expected: [null, null, null],
    },
    {
      name: "drops duplicate seq",
      fixes: [fix({ seq: 5 }), fix({ seq: 5, ts: 1_760_000_001_000 })],
      expected: [null, "duplicate_seq"],
    },
    {
      name: "drops non-increasing (out-of-order) seq even with newer ts",
      fixes: [
        fix({ seq: 10 }),
        fix({ seq: 8, ts: 1_760_000_005_000 }),
        fix({ seq: 10, ts: 1_760_000_006_000 }),
      ],
      expected: [null, "duplicate_seq", "duplicate_seq"],
    },
    {
      name: "a rejected fix still consumes its seq",
      fixes: [
        fix({ seq: 1 }),
        fix({ seq: 2, ts: 1_760_000_001_000, acc: 90 }),
        fix({ seq: 2, ts: 1_760_000_001_000, acc: 90 }),
      ],
      expected: [null, "poor_accuracy", "duplicate_seq"],
    },
    {
      name: "drops acc > 50, accepts acc = 50",
      fixes: [
        fix({ seq: 1, acc: 50 }),
        fix({ seq: 2, ts: 1_760_000_001_000, acc: 50.1 }),
        fix({ seq: 3, ts: 1_760_000_002_000, acc: 12 }),
      ],
      expected: [null, "poor_accuracy", null],
    },
    {
      name: "drops non-finite acc/lat/lng as invalid",
      fixes: [
        fix({ seq: 1, acc: NaN }),
        fix({ seq: 2, lat: NaN }),
        fix({ seq: 3, lng: Infinity }),
        fix({ seq: 4 }),
      ],
      expected: ["invalid", "invalid", "invalid", null],
    },
    {
      name: "drops teleports (implied speed > 42 m/s), keeps plausible moves",
      fixes: [
        fix({ seq: 1 }),
        // 100 m in 1 s = 100 m/s → teleport.
        fix({
          seq: 2,
          ts: 1_760_000_001_000,
          lat: -1.3 + 100 * DEG_PER_METER_LAT,
        }),
        // 30 m in 1 s from the LAST ACCEPTED fix = 30 m/s → fine.
        fix({
          seq: 3,
          ts: 1_760_000_001_000,
          lat: -1.3 + 30 * DEG_PER_METER_LAT,
        }),
      ],
      expected: [null, "teleport", null],
    },
    {
      name: "near-zero dt cannot launder a jump (dt floored at 0.25 s)",
      fixes: [
        fix({ seq: 1 }),
        // 20 m with the same timestamp → 20 / 0.25 = 80 m/s → teleport.
        fix({ seq: 2, lat: -1.3 + 20 * DEG_PER_METER_LAT }),
      ],
      expected: [null, "teleport"],
    },
    {
      name: "drops ts regressions > 2 s, tolerates small ones",
      fixes: [
        fix({ seq: 1 }),
        fix({ seq: 2, ts: 1_760_000_000_000 - 3000 }),
        fix({ seq: 3, ts: 1_760_000_000_000 - 1000, lat: -1.29999 }),
      ],
      expected: [null, "ts_regression", null],
    },
  ];

  it.each(cases)("$name", ({ fixes, expected }) => {
    const gate = new IngestGate();
    const results = fixes.map((f) => gate.push(f));
    expect(results.map((r) => r.reason)).toEqual(expected);
    results.forEach((r, i) => {
      expect(r.accepted === null).toBe(expected[i] !== null);
    });
  });
});

describe("derived signals", () => {
  it("smooths speed with an EMA", () => {
    const gate = new IngestGate({ speedSmoothingAlpha: 0.4 });
    const first = gate.push(fix({ seq: 1, spd: 10 })).accepted!;
    expect(first.smoothedSpd).toBe(10);
    const second = gate.push(
      fix({ seq: 2, ts: 1_760_000_001_000, spd: 0 }),
    ).accepted!;
    // 0.4 * 0 + 0.6 * 10
    expect(second.smoothedSpd).toBeCloseTo(6);
  });

  it("falls back to implied speed when device speed is NaN", () => {
    const gate = new IngestGate({ speedSmoothingAlpha: 1 });
    gate.push(fix({ seq: 1, spd: NaN }));
    // 10 m in 1 s with NaN device speed → implied 10 m/s.
    const second = gate.push(
      fix({
        seq: 2,
        ts: 1_760_000_001_000,
        lat: -1.3 + 10 * DEG_PER_METER_LAT,
        spd: NaN,
      }),
    ).accepted!;
    expect(second.smoothedSpd).toBeGreaterThan(9);
    expect(second.smoothedSpd).toBeLessThan(11);
  });

  it("discards bearing below 1.5 m/s and normalizes it when valid", () => {
    const gate = new IngestGate();
    const slow = gate.push(fix({ seq: 1, spd: 1.0, brg: 123 })).accepted!;
    expect(slow.heading).toBeNull();

    const gate2 = new IngestGate();
    const moving = gate2.push(fix({ seq: 1, spd: 8, brg: -10 })).accepted!;
    expect(moving.heading).toBeCloseTo(350);

    const gate3 = new IngestGate();
    const nanBrg = gate3.push(fix({ seq: 1, spd: 8, brg: NaN })).accepted!;
    expect(nanBrg.heading).toBeNull();
  });

  it("reset() clears seq/position/speed state", () => {
    const gate = new IngestGate();
    gate.push(fix({ seq: 10, spd: 10 }));
    gate.reset();
    expect(gate.last).toBeNull();
    // Same seq accepted again after reset; smoothing starts fresh.
    const again = gate.push(fix({ seq: 10, spd: 0 })).accepted!;
    expect(again.smoothedSpd).toBe(0);
  });
});

describe("trace acceptance (Step 2 acceptance criteria)", () => {
  it("rejects < 10% of the committed realistic trace", () => {
    const gate = new IngestGate();
    let rejected = 0;
    for (const f of realTrace) {
      if (!gate.push(f).accepted) rejected++;
    }
    expect(realTrace.length).toBeGreaterThan(80);
    expect(rejected / realTrace.length).toBeLessThan(0.1);
  });

  it("rejects exactly the injected corruptions and nothing else", () => {
    const entries = corruptTrace(realTrace);
    const gate = new IngestGate();

    // The clean baseline: which of the original fixes the gate accepts.
    const baseline = new IngestGate();
    const baselineAccepted: Set<LocationFix> = new Set();
    for (const f of realTrace) {
      if (baseline.push(f).accepted) baselineAccepted.add(f);
    }

    for (const entry of entries) {
      const result = gate.push(entry.fix);
      if (entry.corruption !== null) {
        expect(result.accepted).toBeNull();
      } else if (baselineAccepted.has(entry.fix)) {
        // Every fix the clean run accepted must still be accepted with
        // corruption interleaved — corrupt fixes must not poison state.
        expect(result.reason).toBeNull();
      }
    }
  });
});

describe("replay fix source", () => {
  it("re-emits the trace with compressed timing and loops with reset hook", () => {
    jest.useFakeTimers();
    try {
      const mini = realTrace.slice(0, 5);
      const seen: number[] = [];
      let loops = 0;
      const source = createReplayFixSource(mini, {
        speed: 10,
        loop: true,
        onLoop: () => loops++,
      });
      const unsub = source((f) => seen.push(f.seq));

      // One full pass at 10× compression (loop restarts with 0 delay, so the
      // second pass's first fix may land in the same window — assert prefix).
      const totalMs = (mini[4].ts - mini[0].ts) / 10;
      jest.advanceTimersByTime(totalMs + 5);
      expect(seen.slice(0, 5)).toEqual(mini.map((f) => f.seq));
      expect(loops).toBe(1);

      const afterFirstPass = seen.length;
      unsub();
      jest.advanceTimersByTime(totalMs * 3);
      expect(seen.length).toBe(afterFirstPass);
    } finally {
      jest.useRealTimers();
    }
  });
});
