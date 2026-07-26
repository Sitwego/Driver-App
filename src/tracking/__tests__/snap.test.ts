import { describe, expect, it } from "@jest/globals";

import { IngestGate } from "../ingestGate";
import { buildRouteTable, pointAt } from "../routeGeometry";
import { Snapper, type SnapInput, type SnapResult } from "../snap";
import type { LocationFix, RouteTable } from "../types";
import {
  SHORT_ROUTE_POINTS,
  U_ROUTE_AMBIGUOUS_POINT,
  U_ROUTE_POINTS,
} from "../testing/fixtures";
import trace from "../testing/fixtures/nairobi-sim-trace.json";

const realTrace = trace as LocationFix[];

const DEG_PER_METER_LAT = 1 / 111_195;
// At Nairobi latitude (−1.3°) the lng correction is < 0.03% — ignore it.
const DEG_PER_METER_LNG = DEG_PER_METER_LAT;

const uTable = buildRouteTable(U_ROUTE_POINTS);

/** On-route point at distance d, offset `eastM` meters perpendicular (east). */
function fixAt(table: RouteTable, d: number, eastM = 0): SnapInput {
  const p = pointAt(table, d);
  return { lat: p.lat, lng: p.lng + eastM * DEG_PER_METER_LNG };
}

/** d of the hairpin apex — everything below is the out-leg, above the return-leg. */
const hairpinD = uTable.cumDist[5];

describe("Snapper — basic snapping and monotonicity", () => {
  it("acquires the first fix with a full-route search", () => {
    const snapper = new Snapper(uTable);
    // No prior d: a fix deep along the route must still be found.
    const r = snapper.push(fixAt(uTable, 700, 5));
    expect(r.status).toBe("snapped");
    expect(r.d).toBeGreaterThan(650);
    expect(r.d).toBeLessThan(750);
    expect(r.perpendicularM).toBeGreaterThan(3);
    expect(r.perpendicularM).toBeLessThan(7);
  });

  it("clamps a projection behind the current d (never moves backward)", () => {
    const snapper = new Snapper(uTable);
    snapper.push(fixAt(uTable, 200));
    const r = snapper.push(fixAt(uTable, 150)); // GPS noise pulling backward
    expect(r.d).toBeCloseTo(200, 6); // pinned (fp epsilon from the projection round-trip)
    // Rendered position pins to the current d, not the backward projection.
    const expected = pointAt(uTable, r.d);
    expect(r.lat).toBeCloseTo(expected.lat, 10);
    expect(r.lng).toBeCloseTo(expected.lng, 10);
  });

  it("reports the route tangent as bearing while snapped", () => {
    const snapper = new Snapper(uTable);
    const r = snapper.push(fixAt(uTable, 100, 8));
    // Out-leg runs almost due north.
    expect(r.bearing).not.toBeNull();
    expect(Math.abs((((r.bearing! + 180) % 360) - 180))).toBeLessThan(10);
  });

  it("clamps the search window on a very short route (never wraps)", () => {
    const shortTable = buildRouteTable(SHORT_ROUTE_POINTS);
    const snapper = new Snapper(shortTable);
    snapper.push(fixAt(shortTable, 10));
    const end = snapper.push(fixAt(shortTable, 105));
    expect(end.status).toBe("snapped");
    expect(end.d).toBeLessThanOrEqual(shortTable.totalLength);
    expect(end.d).toBeGreaterThan(95);
  });
});

describe("Snapper — U-turn fixture never snaps to the wrong leg", () => {
  it("keeps the ambiguous mid-point on the out-leg while outbound", () => {
    const snapper = new Snapper(uTable);
    // Drive up the out-leg to ~d=500.
    for (let d = 0; d <= 500; d += 50) snapper.push(fixAt(uTable, d, 3));
    // The ambiguous point is equidistant from both legs; the window must
    // resolve it to the out-leg (d ≈ 555), never the return-leg (d ≈ 1700).
    const r = snapper.push({
      lat: U_ROUTE_AMBIGUOUS_POINT.latitude,
      lng: U_ROUTE_AMBIGUOUS_POINT.longitude,
    });
    expect(r.status).toBe("snapped");
    expect(r.d).toBeLessThan(hairpinD);
  });

  it("keeps the ambiguous mid-point on the return-leg while inbound, d never decreasing across the hairpin", () => {
    const snapper = new Snapper(uTable);
    const ds: number[] = [];
    // Full drive: out-leg, hairpin, into the return-leg past the ambiguous latitude.
    for (let d = 0; d <= 1750; d += 40) {
      ds.push(snapper.push(fixAt(uTable, d, 2)).d);
    }
    const r = snapper.push({
      lat: U_ROUTE_AMBIGUOUS_POINT.latitude,
      lng: U_ROUTE_AMBIGUOUS_POINT.longitude,
    });
    ds.push(r.d);
    expect(r.status).toBe("snapped");
    expect(r.d).toBeGreaterThan(hairpinD); // resolved to the return-leg
    for (let i = 1; i < ds.length; i++) {
      expect(ds[i]).toBeGreaterThanOrEqual(ds[i - 1]);
    }
  });
});

describe("Snapper — off-route detection and re-acquire", () => {
  /** Drives to d=300, then `count` fixes at `eastM` perpendicular offset. */
  function diverge(snapper: Snapper, count: number, eastM: number): SnapResult[] {
    for (let d = 0; d <= 300; d += 50) snapper.push(fixAt(uTable, d, 2));
    const out: SnapResult[] = [];
    for (let i = 0; i < count; i++) {
      out.push(snapper.push(fixAt(uTable, 300 + i * 20, eastM)));
    }
    return out;
  }

  it("stays snapped through fewer than 5 far fixes", () => {
    const snapper = new Snapper(uTable);
    const results = diverge(snapper, 4, 50);
    for (const r of results) expect(r.status).toBe("snapped");
    // A near fix resets the streak.
    expect(snapper.push(fixAt(uTable, 400, 5)).status).toBe("snapped");
    for (let i = 0; i < 4; i++) {
      expect(snapper.push(fixAt(uTable, 420 + i * 20, 50)).status).toBe("snapped");
    }
  });

  it("declares off_route on the 5th consecutive far fix and passes raw fixes through", () => {
    const snapper = new Snapper(uTable);
    const results = diverge(snapper, 5, 50);
    expect(results.slice(0, 4).every((r) => r.status === "snapped")).toBe(true);
    const off = results[4];
    expect(off.status).toBe("off_route");
    expect(off.bearing).toBeNull();
    // Raw passthrough: rendered position is the raw fix, ~50 m east of the route.
    const raw = fixAt(uTable, 380, 50);
    expect(off.lat).toBeCloseTo(raw.lat, 10);
    expect(off.lng).toBeCloseTo(raw.lng, 10);
    // d frozen at the last snapped value.
    const frozen = off.d;
    const later = snapper.push(fixAt(uTable, 420, 60));
    expect(later.status).toBe("off_route");
    expect(later.d).toBe(frozen);
  });

  it("re-acquires after 3 consecutive fixes within 20 m", () => {
    const snapper = new Snapper(uTable);
    diverge(snapper, 5, 50); // now off-route around d≈380
    // Two near fixes are not enough…
    expect(snapper.push(fixAt(uTable, 450, 10)).status).toBe("off_route");
    expect(snapper.push(fixAt(uTable, 470, 8)).status).toBe("off_route");
    // …a far blip resets the near streak…
    expect(snapper.push(fixAt(uTable, 490, 40)).status).toBe("off_route");
    expect(snapper.push(fixAt(uTable, 510, 10)).status).toBe("off_route");
    expect(snapper.push(fixAt(uTable, 530, 8)).status).toBe("off_route");
    // …the 3rd consecutive near fix snaps back at its own projection.
    const back = snapper.push(fixAt(uTable, 550, 5));
    expect(back.status).toBe("snapped");
    expect(back.d).toBeGreaterThan(520);
    expect(back.d).toBeLessThan(580);
    expect(back.bearing).not.toBeNull();
  });

  it("widens the re-acquire window by the raw distance traveled off-route", () => {
    const snapper = new Snapper(uTable, { aheadWindowM: 100 });
    for (let d = 0; d <= 200; d += 50) snapper.push(fixAt(uTable, d, 2));
    // Go off-route (5 far fixes), then travel ~600 m parallel to the route —
    // far beyond the 100 m ahead-window frozen at d≈280.
    for (let i = 0; i < 5; i++) snapper.push(fixAt(uTable, 200 + i * 20, 60));
    for (let d = 300; d <= 900; d += 60) snapper.push(fixAt(uTable, d, 60));
    // Rejoin at d≈900: only reachable because the window widened with travel.
    snapper.push(fixAt(uTable, 900, 10));
    snapper.push(fixAt(uTable, 920, 8));
    const back = snapper.push(fixAt(uTable, 940, 5));
    expect(back.status).toBe("snapped");
    expect(back.d).toBeGreaterThan(870);
  });

  it("uses the 45 m threshold for boda ride type", () => {
    const car = new Snapper(uTable);
    const boda = new Snapper(uTable, { rideType: "boda" });
    const carResults = diverge(car, 6, 38);
    // 38 m offset: beyond the 30 m car threshold…
    expect(carResults.some((r) => r.status === "off_route")).toBe(true);
    // …but inside the 45 m boda threshold (motorcycles leave the road network).
    for (let d = 0; d <= 300; d += 50) boda.push(fixAt(uTable, d, 2));
    for (let i = 0; i < 6; i++) {
      expect(boda.push(fixAt(uTable, 300 + i * 20, 38)).status).toBe("snapped");
    }
  });

  it("reset() drops all state back to acquisition", () => {
    const snapper = new Snapper(uTable);
    diverge(snapper, 5, 50);
    expect(snapper.status).toBe("off_route");
    snapper.reset();
    expect(snapper.status).toBe("snapped");
    expect(snapper.currentD).toBeNull();
    const r = snapper.push(fixAt(uTable, 100, 3));
    expect(r.status).toBe("snapped");
    expect(r.d).toBeGreaterThan(80);
    expect(r.d).toBeLessThan(120);
  });
});

describe("Snapper — committed trace replay (acceptance)", () => {
  it("d never decreases and the vehicle never goes off-route on the clean trace", () => {
    const gate = new IngestGate();
    const snapper = new Snapper(uTable);
    let lastD = -Infinity;
    let accepted = 0;
    for (const raw of realTrace) {
      const { accepted: fix } = gate.push(raw);
      if (!fix) continue;
      accepted += 1;
      const r = snapper.push(fix);
      expect(r.status).toBe("snapped");
      expect(r.d).toBeGreaterThanOrEqual(lastD);
      lastD = r.d;
    }
    // Sanity: the replay actually exercised the snapper.
    expect(accepted).toBeGreaterThan(80);
    expect(lastD).toBeGreaterThan(uTable.totalLength * 0.9);
  });
});
