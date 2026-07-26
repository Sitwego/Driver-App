// ----------------------------------------------------------------
// Shared types for the real-time vehicle tracking pipeline.
//
// Everything here is plain data — no react-native / expo imports —
// so every module in src/tracking can run under Jest in plain Node
// and inside Reanimated worklets unchanged.
// ----------------------------------------------------------------

/** A single raw GPS fix as delivered by the transport layer. */
export interface LocationFix {
  /** Monotonic counter — the ordering authority. */
  seq: number;
  /** Device epoch ms when the fix was measured. */
  ts: number;
  lat: number;
  lng: number;
  /** Horizontal accuracy, meters. */
  acc: number;
  /** Speed in m/s (may be 0/NaN on some devices). */
  spd: number;
  /** Degrees course-over-ground (may be garbage at low speed). */
  brg: number;
}

export type Unsubscribe = () => void;

/**
 * The transport boundary of the pipeline. Real network sources and
 * replay/mock sources are interchangeable behind this signature.
 */
export type FixSource = (onFix: (fix: LocationFix) => void) => Unsubscribe;

/** A geographic coordinate. Field names match react-native-maps. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Precomputed route lookup table — the plain-data product of route
 * preprocessing (natively via the MapsGeometry Nitro module, or the
 * pure-TS fallback). Consumed at frame rate by `pointAt`; must stay
 * a bag of plain arrays so it can be captured by worklets.
 *
 * Invariants:
 * - all arrays have the same length `n` (route vertices, deduped);
 * - `cumDist[0] === 0`, strictly increasing, `cumDist[n-1] === totalLength`;
 * - `bearings[i]` is the compass heading of segment i → i+1;
 *   `bearings[n-1]` repeats `bearings[n-2]` so lookups never go out of range.
 */
export interface RouteTable {
  lats: number[];
  lngs: number[];
  cumDist: number[];
  bearings: number[];
  totalLength: number;
}

/** Result of projecting a raw point onto the route polyline. */
export interface PathProjection {
  /** Distance along the route (meters from route start). */
  d: number;
  /** Perpendicular distance from the point to the polyline, meters. */
  perpendicularM: number;
  /** Index of the segment (points[i] → points[i+1]) the point projects onto. */
  segmentIndex: number;
}

/** Output of `pointAt` — reused across calls on the hot path (zero-alloc). */
export interface RoutePoint {
  lat: number;
  lng: number;
  bearing: number;
}

/** Inclusive vertex index range used to constrain projection searches. */
export interface IndexWindow {
  startIdx: number;
  endIdx: number;
}
