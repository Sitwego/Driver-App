import { describe, expect, it } from "@jest/globals";

import { computeDistanceBetween } from "../geo";
import { IngestGate } from "../ingestGate";
import {
  createMotionModel,
  motionOnFix,
  motionOnForeground,
  motionTick,
} from "../motionModel";
import { buildRouteTable, pointAt } from "../routeGeometry";
import { Snapper } from "../snap";
import { U_ROUTE_POINTS } from "../testing/fixtures";
import type { LatLng, LocationFix } from "../types";

const uTable = buildRouteTable(U_ROUTE_POINTS);
const BASE_TS = 1_760_000_000_000;
const TICK_S = 1 / 60;
const ms = (tS: number) => BASE_TS + tS * 1000;

describe("motionOnForeground — background → foreground (Step 7)", () => {
  it("fast-forwards once (≤ 1.5 s, eased) when fixes kept arriving in background", () => {
    const model = createMotionModel(uTable);
    // Foreground phase: fixes + ticks to t=30 at 10 m/s.
    let nextFix = 0;
    for (let t = 0; t <= 30; t += TICK_S) {
      if (t >= nextFix) {
        motionOnFix(model, 10 * nextFix, ms(nextFix), 10, ms(nextFix));
        nextFix += 2;
      }
      motionTick(model, ms(t));
    }
    const dAtBackground = model.dRender;

    // Background phase: 60 s of fixes arrive, NO ticks run.
    for (let t = 32; t <= 90; t += 2) {
      motionOnFix(model, 10 * t, ms(t), 10, ms(t));
    }

    // Foreground: discard "now", resume ticking at t=90.
    motionOnForeground(model);
    const records: { t: number; d: number }[] = [];
    for (let t = 90; t <= 93; t += TICK_S) {
      motionTick(model, ms(t));
      records.push({ t, d: model.dRender });
    }

    // First resumed tick must not jump (Δt = 0 after the clock discard).
    expect(records[0].d).toBeCloseTo(dAtBackground, 6);
    // Never decreases.
    for (let i = 1; i < records.length; i++) {
      expect(records[i].d).toBeGreaterThanOrEqual(records[i - 1].d);
    }
    // Within 1.5 s it has fast-forwarded to the delayed target
    // (~10 m/s × (90 − delay) ≈ 850+ m), NOT crawled at 1.5×.
    const after = records.find((r) => r.t >= 91.6)!;
    expect(after.d).toBeGreaterThan(830);
    // The backlog was not replayed in real time: the whole catch-up of
    // ~550 m happened inside the fast-forward window.
    const crawlBudget = 15 * 1.6; // what 1.5× catch-up alone could cover
    expect(after.d - dAtBackground).toBeGreaterThan(crawlBudget);
  });

  it("silent background falls back to staleness + fast-forward on the next fix", () => {
    const model = createMotionModel(uTable);
    let nextFix = 0;
    for (let t = 0; t <= 30; t += TICK_S) {
      if (t >= nextFix) {
        motionOnFix(model, 10 * nextFix, ms(nextFix), 10, ms(nextFix));
        nextFix += 2;
      }
      motionTick(model, ms(t));
    }
    // 60 s background with NO fixes, then foreground.
    motionOnForeground(model);
    motionTick(model, ms(90));
    const dResume = model.dRender;
    // Stale immediately (last arrival was ~t=30); the first resumed tick
    // must not jump (Δt = 0 after the clock discard).
    expect(model.stale).toBe(true);
    expect(dResume).toBeLessThan(320); // ≈ where it stopped, not 60 s ahead
    // The decay glides to a stop within its 3 s budget…
    for (let t = 90; t <= 94; t += TICK_S) motionTick(model, ms(t));
    const dStopped = model.dRender;
    expect(dStopped - dResume).toBeLessThan(35);
    motionTick(model, ms(94.5));
    expect(model.dRender).toBeCloseTo(dStopped, 6); // fully stopped

    // Fixes resume: one capped fast-forward toward the new target.
    motionOnFix(model, 10 * 95, ms(95), 10, ms(95));
    for (let t = 95; t <= 97; t += TICK_S) motionTick(model, ms(t));
    expect(model.stale).toBe(false);
    expect(model.dRender).toBeGreaterThan(dStopped + 100);
  });
});

describe("leg switch — continuity (Step 7)", () => {
  it("re-projecting on the new leg never jumps backward and stays continuous", () => {
    // Leg 1 = out-leg to the hairpin; leg 2 = hairpin onward (multi-stop).
    const leg1 = buildRouteTable(U_ROUTE_POINTS.slice(0, 6));
    const leg2 = buildRouteTable(U_ROUTE_POINTS.slice(5));

    // Drive leg 1 to near its end through the real pipeline (60 Hz ticks).
    const gate = new IngestGate();
    const snapper1 = new Snapper(leg1);
    const model1 = createMotionModel(leg1);
    let seq = 1;
    let nextFix = 0;
    let lastAccepted: ReturnType<IngestGate["push"]>["accepted"] = null;
    for (let t = 0; t <= 110; t += TICK_S) {
      if (t >= nextFix) {
        const p = pointAt(leg1, Math.min(10 * nextFix, leg1.totalLength));
        const fix: LocationFix = {
          seq: seq++,
          ts: ms(nextFix),
          lat: p.lat,
          lng: p.lng,
          acc: 8,
          spd: 10,
          brg: p.bearing,
        };
        nextFix += 2;
        const r = gate.push(fix);
        if (r.accepted) {
          lastAccepted = r.accepted;
          const snap = snapper1.push(r.accepted);
          if (snap.status === "snapped") {
            motionOnFix(
              model1,
              snap.d,
              r.accepted.ts,
              r.accepted.smoothedSpd,
              ms(t),
            );
          }
        }
      }
      motionTick(model1, ms(t));
    }
    const before: LatLng = {
      latitude: model1.lat,
      longitude: model1.lng,
    };
    expect(lastAccepted).not.toBeNull();

    // Leg switch: fresh snapper (full-route first search, clamp reset),
    // fresh model, last accepted fix re-projected — the hook's wiring.
    const snapper2 = new Snapper(leg2);
    const model2 = createMotionModel(leg2);
    const snap2 = snapper2.push(lastAccepted!);
    expect(snap2.status).toBe("snapped");
    motionOnFix(
      model2,
      snap2.d,
      lastAccepted!.ts,
      lastAccepted!.smoothedSpd,
      ms(112),
    );
    motionTick(model2, ms(112));

    const after: LatLng = { latitude: model2.lat, longitude: model2.lng };
    // Continuity: the rendered position moves by at most the render-delay
    // lag (delay × speed ≈ 50 m), never a teleport across the map …
    expect(computeDistanceBetween(before, after)).toBeLessThan(80);
    // … and progress on the new leg is forward-only from there.
    let lastD = model2.dRender;
    let nextFix2 = 114;
    for (let t = 114; t <= 140; t += TICK_S) {
      if (t >= nextFix2) {
        const p = pointAt(
          leg2,
          Math.min(10 * (nextFix2 - 110), leg2.totalLength),
        );
        const fix: LocationFix = {
          seq: seq++,
          ts: ms(nextFix2),
          lat: p.lat,
          lng: p.lng,
          acc: 8,
          spd: 10,
          brg: p.bearing,
        };
        nextFix2 += 2;
        const r = gate.push(fix);
        if (r.accepted) {
          const snap = snapper2.push(r.accepted);
          if (snap.status === "snapped") {
            motionOnFix(
              model2,
              snap.d,
              r.accepted.ts,
              r.accepted.smoothedSpd,
              ms(t),
            );
          }
        }
      }
      motionTick(model2, ms(t));
      expect(model2.dRender).toBeGreaterThanOrEqual(lastD);
      lastD = model2.dRender;
    }
  });
});

describe("feature flag fallback (Step 7)", () => {
  it("fails closed outside the app (no firebase, no __DEV__)", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const flags = require("../flags") as typeof import("../flags");
    expect(flags.isSmoothTrackingEnabled()).toBe(false);
    flags.__setSmoothTrackingOverride(true);
    expect(flags.isSmoothTrackingEnabled()).toBe(true);
    flags.__setSmoothTrackingOverride(null);
  });
});
