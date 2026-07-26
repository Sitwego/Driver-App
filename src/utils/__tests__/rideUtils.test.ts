import { describe, expect, it } from "@jest/globals";

import { RIDE_REQUEST_TTL_SEC, rideRequestRemainingSec } from "../rideUtils";

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
