import { describe, expect, it } from "@jest/globals";

import { IngestGate } from "../ingestGate";
import { buildRouteTable } from "../routeGeometry";
import { Snapper, type SnapStatus } from "../snap";
import { U_ROUTE_POINTS } from "../testing/fixtures";
import {
  applyHarnessFaults,
  NO_FAULTS,
  type HarnessFaults,
} from "../testing/traceTransforms";
import type { LocationFix } from "../types";
import trace from "../testing/fixtures/nairobi-sim-trace.json";

const clean = trace as LocationFix[];
const uTable = buildRouteTable(U_ROUTE_POINTS);

const withFault = (patch: Partial<HarnessFaults>): HarnessFaults => ({
  ...NO_FAULTS,
  ...patch,
});

/** Runs a trace through gate → snapper, collecting statuses and reasons. */
function runPipeline(fixes: readonly LocationFix[]) {
  const gate = new IngestGate();
  const snapper = new Snapper(uTable);
  const reasons: string[] = [];
  const statuses: SnapStatus[] = [];
  for (const f of fixes) {
    const r = gate.push(f);
    if (r.accepted) statuses.push(snapper.push(r.accepted).status);
    else reasons.push(r.reason!);
  }
  return { reasons, statuses };
}

describe("applyHarnessFaults", () => {
  it("is deterministic for a given seed and a no-op without faults", () => {
    expect(applyHarnessFaults(clean, NO_FAULTS)).toEqual(clean);
    const a = applyHarnessFaults(clean, withFault({ dropFixes: true }), 7);
    const b = applyHarnessFaults(clean, withFault({ dropFixes: true }), 7);
    expect(a).toEqual(b);
  });

  it("dropFixes removes ~20% while preserving order and the first fixes", () => {
    const out = applyHarnessFaults(clean, withFault({ dropFixes: true }));
    expect(out.length).toBeLessThan(clean.length);
    expect(out.length).toBeGreaterThan(clean.length * 0.65);
    expect(out[0]).toEqual(clean[0]);
    expect(out[1]).toEqual(clean[1]);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].seq).toBeGreaterThan(out[i - 1].seq);
    }
  });

  it("gap30s opens a ≥ 30 s hole and removes nothing else", () => {
    const out = applyHarnessFaults(clean, withFault({ gap30s: true }));
    expect(out.length).toBeLessThan(clean.length);
    let maxGap = 0;
    for (let i = 1; i < out.length; i++) {
      maxGap = Math.max(maxGap, out[i].ts - out[i - 1].ts);
    }
    expect(maxGap).toBeGreaterThanOrEqual(30_000);
    // Everything kept is an untouched clean fix.
    for (const f of out) expect(clean).toContainEqual(f);
  });

  it("duplicateSeq re-deliveries are rejected exactly, originals unaffected", () => {
    const out = applyHarnessFaults(clean, withFault({ duplicateSeq: true }));
    const inserted = out.length - clean.length;
    expect(inserted).toBeGreaterThan(3);
    const { reasons } = runPipeline(out);
    expect(reasons.filter((r) => r === "duplicate_seq").length).toBe(inserted);
    // The clean baseline rejects nothing, so nothing else may be rejected.
    expect(reasons.length).toBe(inserted);
  });

  it("outOfOrder late deliveries are rejected, one per swap", () => {
    const out = applyHarnessFaults(clean, withFault({ outOfOrder: true }));
    expect(out.length).toBe(clean.length);
    let swaps = 0;
    for (let i = 3; i + 1 < clean.length; i += 10) swaps++;
    const { reasons } = runPipeline(out);
    expect(reasons.filter((r) => r === "duplicate_seq").length).toBe(swaps);
  });

  it("detour reproduces off-route → re-acquire through the real pipeline", () => {
    const out = applyHarnessFaults(clean, withFault({ detour: true }));
    const { statuses } = runPipeline(out);
    const firstOff = statuses.indexOf("off_route");
    expect(firstOff).toBeGreaterThan(0);
    const backOn = statuses.indexOf("snapped", firstOff);
    expect(backOn).toBeGreaterThan(firstOff);
    // Ends the trace snapped (the detour returns to the route).
    expect(statuses[statuses.length - 1]).toBe("snapped");
  });

  it("accuracyDegradation causes poor_accuracy rejections in its window only", () => {
    const out = applyHarnessFaults(clean, withFault({ accuracyDegradation: true }));
    expect(out.length).toBe(clean.length);
    const { reasons } = runPipeline(out);
    expect(reasons.filter((r) => r === "poor_accuracy").length).toBeGreaterThan(0);
    // Outside the 64–78% window the fixes are byte-identical.
    const t0 = clean[0].ts;
    const span = clean[clean.length - 1].ts - t0;
    out.forEach((f, i) => {
      const p = (f.ts - t0) / span;
      if (p < 0.64 || p >= 0.78) expect(f).toEqual(clean[i]);
    });
  });

  it("all faults together still make it through the pipeline", () => {
    const out = applyHarnessFaults(clean, {
      dropFixes: true,
      outOfOrder: true,
      duplicateSeq: true,
      gap30s: true,
      detour: true,
      accuracyDegradation: true,
    });
    const { statuses } = runPipeline(out);
    // The pipeline keeps tracking: a healthy share of fixes still lands.
    expect(statuses.length).toBeGreaterThan(clean.length * 0.4);
    expect(statuses[statuses.length - 1]).toBe("snapped");
  });
});
