import { describe, expect, it } from "@jest/globals";

import { computeDistanceBetween } from "../geo";
import {
  buildRouteTable,
  fullIndexRange,
  pointAt,
  pointAtInto,
  prepareRouteTS,
  projectOnPathTS,
  segmentIndexForDistance,
  windowIndexRange,
} from "../routeGeometry";
import type { RoutePoint } from "../types";
import {
  makeLongRoute,
  SHORT_ROUTE_ENCODED,
  U_ROUTE_AMBIGUOUS_POINT,
  U_ROUTE_ENCODED,
  U_ROUTE_POINTS,
} from "../testing/fixtures";

const uTable = prepareRouteTS(U_ROUTE_ENCODED);

/** Meters between a RoutePoint and a lat/lng pair. */
function metersBetween(p: RoutePoint, lat: number, lng: number): number {
  return computeDistanceBetween(
    { latitude: p.lat, longitude: p.lng },
    { latitude: lat, longitude: lng },
  );
}

describe("buildRouteTable", () => {
  it("produces strictly increasing cumDist and consistent totalLength", () => {
    for (let i = 1; i < uTable.cumDist.length; i++) {
      expect(uTable.cumDist[i]).toBeGreaterThan(uTable.cumDist[i - 1]);
    }
    expect(uTable.cumDist[0]).toBe(0);
    expect(uTable.totalLength).toBe(uTable.cumDist[uTable.cumDist.length - 1]);
    // Out-leg ≈ 1.11 km + hairpin + return-leg ≈ 1.11 km.
    expect(uTable.totalLength).toBeGreaterThan(2200);
    expect(uTable.totalLength).toBeLessThan(2350);
  });

  it("keeps all parallel arrays the same length, bearings defined at the last vertex", () => {
    const n = uTable.lats.length;
    expect(uTable.lngs).toHaveLength(n);
    expect(uTable.cumDist).toHaveLength(n);
    expect(uTable.bearings).toHaveLength(n);
    expect(uTable.bearings[n - 1]).toBe(uTable.bearings[n - 2]);
  });

  it("drops consecutive duplicate vertices", () => {
    const table = buildRouteTable([
      { latitude: -1.3, longitude: 36.8 },
      { latitude: -1.3, longitude: 36.8 },
      { latitude: -1.299, longitude: 36.8 },
      { latitude: -1.299, longitude: 36.8 },
      { latitude: -1.298, longitude: 36.8 },
    ]);
    expect(table.lats).toHaveLength(3);
  });

  it("rejects routes with fewer than 2 distinct points", () => {
    expect(() => buildRouteTable([{ latitude: -1.3, longitude: 36.8 }])).toThrow();
    expect(() =>
      buildRouteTable([
        { latitude: -1.3, longitude: 36.8 },
        { latitude: -1.3, longitude: 36.8 },
      ]),
    ).toThrow();
  });
});

describe("pointAt ↔ projectOnPath round-trip (acceptance: within 1 m)", () => {
  it("round-trips on-route points sampled every 10 m along the whole route", () => {
    const { startIdx, endIdx } = fullIndexRange(uTable);
    for (let d = 0; d <= uTable.totalLength; d += 10) {
      const p = pointAt(uTable, d);
      const proj = projectOnPathTS(uTable, p.lat, p.lng, startIdx, endIdx);
      const back = pointAt(uTable, proj.d);
      expect(metersBetween(back, p.lat, p.lng)).toBeLessThan(1);
      // On-route points must also project with ~zero perpendicular error.
      expect(proj.perpendicularM).toBeLessThan(0.01);
    }
  });

  it("recovers d within 1 m for points offset ~10 m perpendicular (GPS noise)", () => {
    // Offset a mid-out-leg point ~10 m east (perpendicular to the northbound leg).
    const d = 300;
    const p = pointAt(uTable, d);
    const offsetLng = p.lng + 10 / (111_320 * Math.cos((p.lat * Math.PI) / 180));
    const { startIdx, endIdx } = fullIndexRange(uTable);
    const proj = projectOnPathTS(uTable, p.lat, offsetLng, startIdx, endIdx);
    expect(Math.abs(proj.d - d)).toBeLessThan(1);
    expect(proj.perpendicularM).toBeGreaterThan(9);
    expect(proj.perpendicularM).toBeLessThan(11);
  });
});

describe("U-shaped route leg disambiguation (acceptance)", () => {
  const point = U_ROUTE_AMBIGUOUS_POINT;
  // The ambiguous point sits at latitude -1.295: ~556 m up the out-leg,
  // and ~556 m before the end on the return-leg.
  const dOnOutLeg = 556;
  const dOnReturnLeg = uTable.totalLength - 556;

  it("is genuinely ambiguous: both legs are within ~12 m of the point", () => {
    const { startIdx, endIdx } = fullIndexRange(uTable);
    const proj = projectOnPathTS(
      uTable,
      point.latitude,
      point.longitude,
      startIdx,
      endIdx,
    );
    expect(proj.perpendicularM).toBeLessThan(12);
  });

  it("resolves to the out-leg when the window is on the out-leg", () => {
    const win = windowIndexRange(uTable, dOnOutLeg, 100, 500);
    const proj = projectOnPathTS(
      uTable,
      point.latitude,
      point.longitude,
      win.startIdx,
      win.endIdx,
    );
    expect(Math.abs(proj.d - dOnOutLeg)).toBeLessThan(15);
  });

  it("resolves to the return-leg when the window is on the return-leg", () => {
    const win = windowIndexRange(uTable, dOnReturnLeg, 100, 500);
    const proj = projectOnPathTS(
      uTable,
      point.latitude,
      point.longitude,
      win.startIdx,
      win.endIdx,
    );
    expect(Math.abs(proj.d - dOnReturnLeg)).toBeLessThan(15);
  });

  it("out-leg window (−100 m … +500 m) does not reach the return leg", () => {
    const win = windowIndexRange(uTable, dOnOutLeg, 100, 500);
    // Return-leg segments start after the hairpin apex (vertex 5).
    expect(win.endIdx).toBeLessThanOrEqual(5);
  });
});

describe("clamping and edge cases", () => {
  it("clamps d below 0 to the route start", () => {
    const p = pointAt(uTable, -50);
    expect(
      metersBetween(p, U_ROUTE_POINTS[0].latitude, U_ROUTE_POINTS[0].longitude),
    ).toBeLessThan(0.001);
  });

  it("clamps d beyond totalLength to the destination (arrival pin)", () => {
    const last = U_ROUTE_POINTS[U_ROUTE_POINTS.length - 1];
    const p = pointAt(uTable, uTable.totalLength + 500);
    expect(metersBetween(p, last.latitude, last.longitude)).toBeLessThan(0.001);
    const atEnd = pointAt(uTable, uTable.totalLength);
    expect(metersBetween(atEnd, last.latitude, last.longitude)).toBeLessThan(0.001);
  });

  it("returns exact vertices at vertex distances", () => {
    for (let i = 0; i < uTable.lats.length; i++) {
      const p = pointAt(uTable, uTable.cumDist[i]);
      expect(metersBetween(p, uTable.lats[i], uTable.lngs[i])).toBeLessThan(0.001);
    }
  });

  it("segmentIndexForDistance never exceeds n-2", () => {
    expect(segmentIndexForDistance(uTable, uTable.totalLength)).toBe(
      uTable.lats.length - 2,
    );
    expect(segmentIndexForDistance(uTable, uTable.totalLength * 10)).toBe(
      uTable.lats.length - 2,
    );
    expect(segmentIndexForDistance(uTable, 0)).toBe(0);
  });

  it("window bounds clamp (never wrap) on very short routes", () => {
    const short = prepareRouteTS(SHORT_ROUTE_ENCODED);
    expect(short.totalLength).toBeLessThan(200);
    const win = windowIndexRange(short, short.totalLength / 2, 100, 500);
    expect(win.startIdx).toBe(0);
    expect(win.endIdx).toBe(0);
    // Projection with a clamped window still works.
    const proj = projectOnPathTS(short, -1.2995, 36.80002, win.startIdx, win.endIdx);
    expect(proj.d).toBeGreaterThan(0);
    expect(proj.d).toBeLessThan(short.totalLength);
  });

  it("projectOnPathTS clamps out-of-range segment indices instead of crashing", () => {
    const proj = projectOnPathTS(uTable, -1.295, 36.80005, -10, 9999);
    expect(proj.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(proj.segmentIndex).toBeLessThanOrEqual(uTable.lats.length - 2);
  });
});

describe("hot-path budget (acceptance: zero alloc, 10k calls < 20 ms)", () => {
  const longTable = buildRouteTable(makeLongRoute(1000));

  it("pointAtInto reuses the caller's output object (no per-call allocation)", () => {
    const out: RoutePoint = { lat: 0, lng: 0, bearing: 0 };
    const returned = pointAtInto(longTable, longTable.totalLength / 2, out);
    expect(returned).toBe(out);
    const again = pointAtInto(longTable, longTable.totalLength / 3, out);
    expect(again).toBe(out);
  });

  it("completes 10,000 pointAtInto calls in < 20 ms", () => {
    const out: RoutePoint = { lat: 0, lng: 0, bearing: 0 };
    const total = longTable.totalLength;

    // Warm up (JIT) before timing.
    for (let i = 0; i < 2000; i++) {
      pointAtInto(longTable, (i * 7919) % total, out);
    }

    const start = performance.now();
    let sink = 0;
    for (let i = 0; i < 10_000; i++) {
      pointAtInto(longTable, (i * 7919) % total, out);
      sink += out.lat; // prevent dead-code elimination
    }
    const elapsed = performance.now() - start;

    expect(Number.isFinite(sink)).toBe(true);
    // NOTE: this runs on Node/V8. The Hermes-device measurement is a
    // Step 6 dev-screen check; see NOTES.md.
    expect(elapsed).toBeLessThan(20);
  });
});
