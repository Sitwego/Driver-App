import type { DiscountedRidesSummary } from "~/hooks/apis";

/**
 * The line beside "Discounted rides" on the payout screen.
 *
 * It has to answer one question — *how much of this has Sitwego not paid me
 * yet?* — and a bare count cannot. Rides stay in the list after they are paid
 * out, so a number on its own reads as the total and then contradicts itself
 * the moment the driver withdraws and it drops.
 *
 * Money inside an unresolved withdrawal is reported separately rather than
 * folded into "awaiting": it has left the wallet but has not arrived, and it
 * can still fail and come back.
 *
 * Returns an empty string when there is nothing to say — before the first fetch
 * lands, and when the driver has never had a discounted ride. Showing "0" in
 * either case would claim a fact we do not have.
 */
export function describeOutstandingCredits(
  summary: DiscountedRidesSummary | undefined,
): string {
  if (!summary || summary.total_rides === 0) return "";

  const { awaiting_payout: awaiting, in_transit: inTransit } = summary;

  if (awaiting > 0) return `${awaiting} awaiting payout`;
  if (inTransit > 0) return `${inTransit} on the way`;
  return "All paid out";
}
