export const roundToNearestTen = (price: number) => {
  return Math.round(price / 10) * 10;
};

export const roundToOneDecimal = (value: number): number => {
  return Number(value.toFixed(1));
};

export function formatPrice(value: number): string {
  return roundToNearestTen(value).toLocaleString();
}

/**
 * Exact, thousands-separated amount with two decimals — e.g. 2450 -> "2,450.00".
 * Unlike `formatPrice` this does not round to the nearest ten, so it is safe for
 * figures that must reconcile against a total (fares, discounts, payouts).
 */
/**
 * Exact whole shillings, thousands-separated — e.g. 12500 -> "12,500".
 *
 * For figures that must reconcile with each other on screen. `formatPrice`
 * rounds to the nearest ten, which visibly breaks a split: 400 = 355 + 45
 * renders as "400 = 360 + 50". `formatAmount` is exact but forces two decimals,
 * which is noise on money the backend already holds in whole shillings.
 */
export function formatWholeKes(value: number): string {
  return Math.round(value).toLocaleString("en-KE");
}

export function formatAmount(value: number): string {
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
