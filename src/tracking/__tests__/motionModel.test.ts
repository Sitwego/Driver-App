import { describe, expect, it } from "@jest/globals";

import { shortestHeadingDelta } from "../geo";
import {
  createMotionModel,
  motionOnFix,
  motionReset,
  motionTick,
  type MotionState,
} from "../motionModel";
import { buildRouteTable } from "../routeGeometry";
import { U_ROUTE_POINTS } from "../testing/fixtures";
import type { LatLng } from "../types";

const uTable = buildRouteTable(U_ROUTE_POINTS);
const BASE_TS = 1_760_000_000_000;
const TICK_S = 1 / 60;

/** Deterministic LCG so the "irregular" simulation is reproducible. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const ms = (tS: number) => BASE_TS + tS * 1000;

interface TickRecord {
  t: number;
  d: number;
  v: number;
  stale: boolean;
  /** true if the fast-forward was active at any point during this tick. */
  ff: boolean;
  bearing: number;
}

/**
 * Drives the model with fixes at the given schedule while ticking at 60 Hz.
 * Fix `ts` and the render clock are the same timeline (zero-latency source).
 */
function runTicks(
  model: MotionState,
  schedule: readonly { t: number; d: number; spd: number }[],
  untilS: number,
): TickRecord[] {
  const records: TickRecord[] = [];
  let next = 0;
  let prevD: number | null = null;
  for (let t = 0; t <= untilS; t += TICK_S) {
    while (next < schedule.length && schedule[next].t <= t) {
      const f = schedule[next++];
      motionOnFix(model, f.d, ms(f.t), f.spd, ms(t));
    }
    const ffBefore = model.ffActive || model.ffPending;
    motionTick(model, ms(t));
    const v = prevD === null ? 0 : (model.dRender - prevD) / TICK_S;
    prevD = model.dRender;
    records.push({
      t,
      d: model.dRender,
      v,
      stale: model.stale,
      ff: ffBefore || model.ffActive,
      bearing: model.bearing,
    });
  }
  return records;
}

const at = (records: TickRecord[], t: number) =>
  records[Math.min(records.length - 1, Math.round(t / TICK_S))];

describe("MotionModel — main simulation (acceptance)", () => {
  // Ground truth: constant 10 m/s along the U-route. Fixes arrive at
  // irregular 1–5 s intervals with 20% random drops and one 30 s gap
  // (100 s → 130 s) during which the vehicle keeps moving.
  const TRUE_SPD = 10;
  const rand = lcg(42);
  const schedule: { t: number; d: number; spd: number }[] = [];
  {
    let t = 0;
    while (t <= 180) {
      const inGap = t >= 100 && t < 130;
      if (!inGap && rand() >= 0.2) {
        schedule.push({ t, d: TRUE_SPD * t, spd: TRUE_SPD });
      }
      t += 1 + 4 * rand();
    }
  }
  const lastBeforeGap = schedule.filter((f) => f.t < 100).at(-1)!.t;
  const resumeT = schedule.find((f) => f.t >= 130)!.t;

  const model = createMotionModel(uTable);
  const records = runTicks(model, schedule, 185);

  it("dRender never decreases — ever", () => {
    for (let i = 1; i < records.length; i++) {
      expect(records[i].d).toBeGreaterThanOrEqual(records[i - 1].d);
    }
  });

  it("rendered speed never exceeds 1.5× ground truth outside the fast-forward", () => {
    const cap = 1.5 * TRUE_SPD + 0.05;
    for (const r of records) {
      if (!r.ff) expect(r.v).toBeLessThanOrEqual(cap);
    }
  });

  it("the capped fast-forward actually fired after the gap (the exemption is not vacuous)", () => {
    expect(records.some((r) => r.ff)).toBe(true);
    // …and only around the resume fix.
    for (const r of records.filter((x) => x.ff)) {
      expect(r.t).toBeGreaterThanOrEqual(resumeT - TICK_S);
      expect(r.t).toBeLessThanOrEqual(resumeT + 1.6);
    }
  });

  it("stale raises 15 s after the last fix and clears when fixes resume", () => {
    expect(at(records, lastBeforeGap + 14.5).stale).toBe(false);
    expect(at(records, lastBeforeGap + 15.5).stale).toBe(true);
    expect(at(records, resumeT + 0.2).stale).toBe(false);
  });

  it("rendered speed decays to 0 within 3 s of going stale", () => {
    const a = at(records, lastBeforeGap + 19);
    const b = at(records, Math.min(lastBeforeGap + 25, resumeT - 0.5));
    expect(b.t).toBeGreaterThan(a.t);
    expect(b.d).toBeCloseTo(a.d, 9); // fully stopped
  });

  it("makes real progress and stays behind/at ground truth + noise floor", () => {
    expect(records.at(-1)!.d).toBeGreaterThan(1500);
    for (const r of records) {
      expect(r.d).toBeLessThanOrEqual(TRUE_SPD * r.t + 1);
    }
  });
});

describe("MotionModel — bearing", () => {
  it("slerps through the 350°→10° north wrap without spinning the long way", () => {
    // Two ~111 m segments: heading ≈ 350°, then ≈ 10°.
    const northCross: LatLng[] = [
      { latitude: -1.3, longitude: 36.8 },
      { latitude: -1.299, longitude: 36.799824 },
      { latitude: -1.298, longitude: 36.8 },
    ];
    const table = buildRouteTable(northCross);
    const model = createMotionModel(table);
    const schedule = [];
    for (let t = 0; t <= 15; t += 1) {
      schedule.push({ t, d: Math.min(15 * t, table.totalLength), spd: 15 });
    }
    const records = runTicks(model, schedule, 15);

    let totalSigned = 0;
    let totalAbs = 0;
    for (let i = 1; i < records.length; i++) {
      const step = shortestHeadingDelta(records[i - 1].bearing, records[i].bearing);
      // No flips: a 60 Hz slerp step across a 20° turn is always small.
      expect(Math.abs(step)).toBeLessThan(15);
      totalSigned += step;
      totalAbs += Math.abs(step);
    }
    // Net rotation ≈ +20° clockwise through north — never −340° the long way.
    expect(totalSigned).toBeGreaterThan(10);
    expect(totalSigned).toBeLessThan(30);
    expect(totalAbs).toBeLessThan(40);
    // Ends on the second segment's heading.
    const end = records.at(-1)!.bearing;
    expect(Math.abs(shortestHeadingDelta(end, 10))).toBeLessThan(3);
  });
});

describe("MotionModel — behaviors", () => {
  it("does not creep while the vehicle is stationary (GPS wander clamp)", () => {
    const model = createMotionModel(uTable);
    // Parked at d=100; the snapper's monotonic clamp lets noise creep the
    // snapped d forward a little; modeled speed stays ≈ 0.1 m/s < 0.5.
    const schedule = [];
    for (let i = 0; i <= 10; i++) {
      schedule.push({ t: i * 2, d: 100 + i * 0.2, spd: 0.3 });
    }
    const records = runTicks(model, schedule, 20);
    for (const r of records) expect(r.d).toBe(100);
  });

  it("freezes when over-extrapolated and resumes only when reality catches up", () => {
    const model = createMotionModel(uTable);
    const schedule = [];
    // 10 m/s, fixes every 2 s until t=20 …
    for (let t = 0; t <= 20; t += 2) schedule.push({ t, d: 10 * t, spd: 10 });
    // … 20 s silence (dead-reckoning overshoots: the vehicle actually
    // crawled), then it resumes at 10 m/s from d=250.
    for (let t = 40; t <= 80; t += 2) {
      schedule.push({ t, d: 250 + 10 * (t - 40), spd: 10 });
    }
    const records = runTicks(model, schedule, 80);
    for (let i = 1; i < records.length; i++) {
      expect(records[i].d).toBeGreaterThanOrEqual(records[i - 1].d);
    }
    // Frozen shortly after the resume fix (target is behind dRender) …
    const frozenD = at(records, 42).d;
    expect(at(records, 46).d).toBe(frozenD);
    // … and moving again once the (delayed) target passes the frozen point.
    expect(at(records, 60).d).toBeGreaterThan(frozenD + 5);
  });

  it("adapts the render delay to 2× the median arrival gap, clamped 1.5–5 s", () => {
    const fast = createMotionModel(uTable);
    for (let i = 0; i < 8; i++) motionOnFix(fast, i, ms(i * 0.5), 5, ms(i * 0.5));
    expect(fast.delayMs).toBe(1500); // 2×500 → floor

    const mid = createMotionModel(uTable);
    for (let i = 0; i < 8; i++) motionOnFix(mid, i, ms(i), 5, ms(i));
    expect(mid.delayMs).toBe(2000);

    const slow = createMotionModel(uTable);
    for (let i = 0; i < 8; i++) motionOnFix(slow, i, ms(i * 4), 5, ms(i * 4));
    expect(slow.delayMs).toBe(5000); // 2×4000 → ceiling

    const fresh = createMotionModel(uTable);
    motionOnFix(fresh, 0, ms(0), 5, ms(0));
    motionOnFix(fresh, 1, ms(1), 5, ms(1));
    expect(fresh.delayMs).toBe(3000); // < 3 gaps: initial delay holds
  });

  it("derives speed from consecutive snapped fixes when device speed is unusable", () => {
    const model = createMotionModel(uTable);
    const schedule = [];
    for (let t = 0; t <= 20; t += 2) schedule.push({ t, d: 10 * t, spd: NaN });
    const records = runTicks(model, schedule, 28);
    // Past the buffer end (t > 20 + delay 4 s) the model dead-reckons at the
    // slope of the last two snapped fixes ≈ 10 m/s.
    const advance = at(records, 28).d - at(records, 26).d;
    expect(advance / 2).toBeGreaterThan(7);
    expect(advance / 2).toBeLessThanOrEqual(10.05);
  });

  it("pins to the destination and raises arrived", () => {
    const model = createMotionModel(uTable);
    const total = uTable.totalLength;
    const schedule = [];
    for (let t = 0; t <= 240; t += 2) {
      schedule.push({ t, d: Math.min(10 * t, total), spd: 10 });
    }
    const records = runTicks(model, schedule, 260);
    expect(model.arrived).toBe(true);
    expect(model.dRender).toBe(total);
    // Once arrived, ticks change nothing.
    const after = records.filter((r) => r.d === total);
    expect(after.length).toBeGreaterThan(10);
  });

  it("motionReset returns to the pre-first-fix state", () => {
    const model = createMotionModel(uTable);
    for (let t = 0; t <= 10; t += 2) {
      motionOnFix(model, 10 * t, ms(t), 10, ms(t));
      motionTick(model, ms(t));
    }
    expect(model.hasFix).toBe(true);
    motionReset(model);
    expect(model.hasFix).toBe(false);
    expect(model.bufTs.length).toBe(0);
    expect(model.delayMs).toBe(3000);
    motionTick(model, ms(100));
    expect(model.dRender).toBe(0);
  });
});
