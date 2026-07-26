/**
 * Address-label derivation for a ride stop.
 *
 * Kept free of react-native and path-alias imports so jest can run it directly
 * (see jest.config.js — `src/utils` is a root and tested modules must be pure TS).
 */

/** Structural subset of `Location` (src/types/rideRequstTypes.ts) used for labelling. */
export type StopLocation = {
  building?: string | null;
  street?: string | null;
  ward?: string | null;
  city?: string | null;
  road?: string | null;
  country?: string | null;
};

export type StopLabels = {
  primary: string;
  secondary: string;
};

const isFilled = (v?: string | null): v is string =>
  typeof v === "string" && v.trim().length > 0;

/**
 * Split a stop into a headline and a supporting address line.
 *
 * The backend populates these fields inconsistently — any of them can be null —
 * so the headline falls through the fields in decreasing specificity and the
 * supporting line is whatever is left. Without the de-dupe the same string
 * routinely renders twice (e.g. `street` chosen as the headline and then
 * repeated inside the address line).
 */
export function deriveStopLabels(
  location: StopLocation | null | undefined,
  fallback: string,
): StopLabels {
  const loc = location ?? {};
  const primary =
    [loc.building, loc.street, loc.ward, loc.road, loc.city].find(isFilled) ??
    fallback;

  const normalizedPrimary = primary.trim().toLowerCase();

  const secondary = [loc.street, loc.ward, loc.city, loc.country]
    .filter(isFilled)
    .map((part) => part.trim())
    .filter(
      (part, index, parts) =>
        part.toLowerCase() !== normalizedPrimary &&
        parts.indexOf(part) === index,
    )
    .join(", ");

  return { primary: primary.trim(), secondary };
}
