import { describe, expect, it } from "@jest/globals";

import { describeOutstandingCredits } from "../payoutUtils";

import type { DiscountedRidesSummary } from "~/hooks/apis";

function summary(
  over: Partial<DiscountedRidesSummary> = {},
): DiscountedRidesSummary {
  return {
    total_rides: 0,
    awaiting_payout: 0,
    in_transit: 0,
    paid_out: 0,
    total_discount: 0,
    currency: "KES",
    ...over,
  };
}

describe("describeOutstandingCredits", () => {
  // Before the first fetch lands we know nothing. "0 awaiting payout" would be
  // a claim, and a wrong one for any driver who is in fact owed money.
  it("says nothing while the summary is unknown", () => {
    expect(describeOutstandingCredits(undefined)).toBe("");
  });

  it("says nothing when the driver has never had a discounted ride", () => {
    expect(describeOutstandingCredits(summary())).toBe("");
  });

  it("counts what is still in the wallet", () => {
    expect(
      describeOutstandingCredits(
        summary({ total_rides: 12, awaiting_payout: 8, paid_out: 4 }),
      ),
    ).toBe("8 awaiting payout");
  });

  // Money inside an unresolved withdrawal has left the wallet but has not
  // arrived. Reporting it as awaiting payout would be wrong (it is already
  // being sent); reporting it as paid would be worse (it can still fail).
  it("reports money in flight separately from money in the wallet", () => {
    expect(
      describeOutstandingCredits(
        summary({ total_rides: 3, awaiting_payout: 0, in_transit: 3 }),
      ),
    ).toBe("3 on the way");
  });

  it("prefers the wallet figure when the driver has both", () => {
    expect(
      describeOutstandingCredits(
        summary({ total_rides: 5, awaiting_payout: 2, in_transit: 3 }),
      ),
    ).toBe("2 awaiting payout");
  });

  // The list keeps rides that have been paid out, so a driver who has
  // withdrawn everything still sees rows. The header has to explain why they
  // are there rather than implying they are still owed.
  it("says the history is settled once everything has been withdrawn", () => {
    expect(
      describeOutstandingCredits(summary({ total_rides: 6, paid_out: 6 })),
    ).toBe("All paid out");
  });

  // Old rides whose discount was netted off a subscription bill are counted in
  // the total but are not outstanding — nothing can withdraw them.
  it("does not treat legacy bill credits as outstanding", () => {
    expect(
      describeOutstandingCredits(summary({ total_rides: 2, paid_out: 0 })),
    ).toBe("All paid out");
  });
});
