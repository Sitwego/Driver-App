import { describe, expect, it } from "@jest/globals";

import { computeDistanceBetween } from "../geo";
import { buildRouteTable, pointAt, splitRouteAt } from "../routeGeometry";
import { U_ROUTE_POINTS } from "../testing/fixtures";

const table = buildRouteTable(U_ROUTE_POINTS);
const n = table.lats.length;

describe("splitRouteAt (Step 5 traveled-route dimming)", () => {
  it("splits mid-segment with both halves sharing the interpolated point", () => {
    const d = table.totalLength / 3;
    const { behind, ahead } = splitRouteAt(table, d);
    const joint = behind[behind.length - 1];
    expect(ahead[0]).toEqual(joint);
    // The joint is the on-route point at d.
    const p = pointAt(table, d);
    expect(joint.latitude).toBeCloseTo(p.lat, 10);
    expect(joint.longitude).toBeCloseTo(p.lng, 10);
    // Every original vertex appears exactly once across both halves.
    expect(behind.length - 1 + (ahead.length - 1)).toBe(n);
  });

  it("d = 0 pins the whole route ahead", () => {
    const { behind, ahead } = splitRouteAt(table, 0);
    expect(behind.length).toBeLessThanOrEqual(2); // first vertex + joint
    expect(ahead.length).toBeGreaterThanOrEqual(n);
    expect(ahead[0].latitude).toBeCloseTo(table.lats[0], 10);
  });

  it("d = totalLength (arrival) pins the whole route behind", () => {
    const { behind, ahead } = splitRouteAt(table, table.totalLength);
    expect(behind.length).toBeGreaterThanOrEqual(n);
    expect(ahead.length).toBeLessThanOrEqual(2);
    const last = behind[behind.length - 1];
    expect(last.latitude).toBeCloseTo(table.lats[n - 1], 10);
  });

  it("clamps out-of-range d instead of wrapping", () => {
    const under = splitRouteAt(table, -50);
    expect(under.ahead.length).toBeGreaterThanOrEqual(n);
    const over = splitRouteAt(table, table.totalLength + 500);
    expect(over.behind.length).toBeGreaterThanOrEqual(n);
  });

  it("halves' lengths sum to the route length", () => {
    for (const d of [10, 400, 1200, table.totalLength - 10]) {
      const { behind, ahead } = splitRouteAt(table, d);
      const len = (pts: typeof behind) => {
        let sum = 0;
        for (let i = 1; i < pts.length; i++) {
          sum += computeDistanceBetween(pts[i - 1], pts[i]);
        }
        return sum;
      };
      expect(len(behind) + len(ahead)).toBeCloseTo(table.totalLength, 6);
      expect(len(behind)).toBeCloseTo(d, 6);
    }
  });
});
