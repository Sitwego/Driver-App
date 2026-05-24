export const roundToNearestTen = (price: number) => {
  return Math.round(price / 10) * 10;
};

export const roundToOneDecimal = (value: number): number => {
  return Number(value.toFixed(1));
};

export function formatPrice(value: number): string {
  return roundToNearestTen(value).toLocaleString();
}
