// ----------------------------------------------------------------
// Test fixtures for the tracking pipeline.
//
// All coordinates sit exactly on the 1e-5° encoded-polyline grid so
// encode → decode is lossless and fixtures can be expressed either
// as coordinates or as encoded strings interchangeably.
// ----------------------------------------------------------------

import type { LatLng } from "../types";
import { encodePolyline } from "../polyline";

/**
 * U-shaped route in Nairobi: ~1.11 km north on an out-leg, a hairpin,
 * and ~1.11 km back south on a return-leg only ~33 m to the east.
 * The two legs are close enough that GPS noise (5–30 m) is ambiguous
 * between them — exactly the case the projection window must resolve.
 */
export const U_ROUTE_POINTS: readonly LatLng[] = [
  { latitude: -1.3, longitude: 36.8 }, // start, heading north
  { latitude: -1.298, longitude: 36.8 },
  { latitude: -1.295, longitude: 36.80005 }, // slight bend
  { latitude: -1.292, longitude: 36.8 },
  { latitude: -1.29, longitude: 36.8 }, // top of out-leg
  { latitude: -1.2899, longitude: 36.80015 }, // hairpin apex
  { latitude: -1.29, longitude: 36.8003 }, // top of return-leg
  { latitude: -1.292, longitude: 36.8003 },
  { latitude: -1.295, longitude: 36.80025 },
  { latitude: -1.298, longitude: 36.8003 },
  { latitude: -1.3, longitude: 36.8003 }, // end, ~33 m east of start
];

export const U_ROUTE_ENCODED = encodePolyline(U_ROUTE_POINTS);

/**
 * A point on the U's axis of symmetry, equidistant (~11 m) from the
 * out-leg and the return-leg at latitude -1.295.
 */
export const U_ROUTE_AMBIGUOUS_POINT: LatLng = {
  latitude: -1.295,
  longitude: 36.80015,
};

/** Short two-vertex route (~110 m) for window-clamping edge cases. */
export const SHORT_ROUTE_POINTS: readonly LatLng[] = [
  { latitude: -1.3, longitude: 36.8 },
  { latitude: -1.299, longitude: 36.8 },
];

export const SHORT_ROUTE_ENCODED = encodePolyline(SHORT_ROUTE_POINTS);

/**
 * Synthetic long route: a gentle spiral with `n` vertices (~30 m
 * segments), used for perf tests so binary search sees a realistic
 * trip-length table (a real Nairobi trip decodes to hundreds of
 * vertices).
 */
export function makeLongRoute(n: number): LatLng[] {
  const points: LatLng[] = [];
  let lat = -1.3;
  let lng = 36.8;
  for (let i = 0; i < n; i++) {
    const angle = i * 0.05;
    lat += 0.00027 * Math.cos(angle);
    lng += 0.00027 * Math.sin(angle);
    // Snap to the polyline grid like real decoded routes.
    points.push({
      latitude: Math.round(lat * 1e5) / 1e5,
      longitude: Math.round(lng * 1e5) / 1e5,
    });
  }
  return points;
}
