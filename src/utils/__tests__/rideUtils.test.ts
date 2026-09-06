import { describe, expect, it } from "@jest/globals";

import {
  RIDE_REQUEST_TTL_SEC,
  normalizeDriverFareSplit,
  rideRequestRemainingSec,
} from "../rideUtils";

describe("rideRequestRemainingSec", () => {
  const NOW = 1_700_000_000_000;

  it("gives the full window when no timestamp is present", () => {
    expect(rideRequestRemainingSec(undefined, NOW)).toBe(RIDE_REQUEST_TTL_SEC);
  });

  it("subtracts the elapsed time for a request still in its window", () => {
    expect(rideRequestRemainingSec(NOW - 8_000, NOW)).toBe(
      RIDE_REQUEST_TTL_SEC - 8,
    );
  });

  it("clamps to zero once the window has passed", () => {
    expect(rideRequestRemainingSec(NOW - 25_000, NOW)).toBe(0);
  });

  it("treats an exactly-expired request as dead", () => {
    expect(
      rideRequestRemainingSec(NOW - RIDE_REQUEST_TTL_SEC * 1000, NOW),
    ).toBe(0);
  });

  it("does not go negative for a clock skewed into the future", () => {
    expect(rideRequestRemainingSec(NOW + 5_000, NOW)).toBe(
      RIDE_REQUEST_TTL_SEC,
    );
  });
});

describe("normalizeDriverFareSplit", () => {
  const discounted = {
    collect_from_rider: 350,
    you_earn: 400,
    platform_covers: 50,
    promotion_id: "01JABCDEF",
    settled: false,
  };

  it("keeps a well-formed split", () => {
    expect(normalizeDriverFareSplit(discounted)).toEqual(discounted);
  });

  it("tells the driver to collect less than they earn, never the reverse", () => {
    // The heart of invariant D1: a promotion reduces the rider's cash, not the
    // driver's income. If these two ever swap, the driver is being shown a pay
    // cut that did not happen.
    const split = normalizeDriverFareSplit(discounted)!;
    expect(split.collect_from_rider).toBe(350);
    expect(split.you_earn).toBe(400);
    expect(split.collect_from_rider).toBeLessThan(split.you_earn);
  });

  it("rejects a split whose figures do not add up", () => {
    // Three numbers that disagree leave the driver unable to quote any of them,
    // so full price is the only honest fallback.
    expect(
      normalizeDriverFareSplit({ ...discounted, platform_covers: 60 }),
    ).toBeNull();
  });

  it("rejects a zero discount as saying nothing the fare does not", () => {
    expect(
      normalizeDriverFareSplit({
        collect_from_rider: 400,
        you_earn: 400,
        platform_covers: 0,
        settled: false,
      }),
    ).toBeNull();
  });

  it("rejects negative figures", () => {
    expect(
      normalizeDriverFareSplit({
        collect_from_rider: 450,
        you_earn: 400,
        platform_covers: -50,
        settled: false,
      }),
    ).toBeNull();
  });

  it("rejects figures that are not finite numbers", () => {
    expect(
      normalizeDriverFareSplit({ ...discounted, you_earn: NaN }),
    ).toBeNull();
    expect(
      normalizeDriverFareSplit({ ...discounted, collect_from_rider: "350" }),
    ).toBeNull();
    expect(
      normalizeDriverFareSplit({ ...discounted, platform_covers: Infinity }),
    ).toBeNull();
  });

  it("returns null for a ride carrying no promotion at all", () => {
    expect(normalizeDriverFareSplit(undefined)).toBeNull();
    expect(normalizeDriverFareSplit(null)).toBeNull();
    expect(normalizeDriverFareSplit({})).toBeNull();
    expect(normalizeDriverFareSplit("promotion")).toBeNull();
  });

  it("carries the settled flag through, defaulting to a live quote", () => {
    expect(
      normalizeDriverFareSplit({ ...discounted, settled: true })!.settled,
    ).toBe(true);
    // Anything but an explicit `true` means the fare can still move, so the
    // figures must not be presented as final.
    expect(
      normalizeDriverFareSplit({
        collect_from_rider: 350,
        you_earn: 400,
        platform_covers: 50,
      })!.settled,
    ).toBe(false);
  });

  it("keeps a free ride, where the platform covers the whole fare", () => {
    const free = normalizeDriverFareSplit({
      collect_from_rider: 0,
      you_earn: 400,
      platform_covers: 400,
      settled: false,
    });
    expect(free?.collect_from_rider).toBe(0);
    expect(free?.you_earn).toBe(400);
  });
});
