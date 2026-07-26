// ----------------------------------------------------------------
// Minimal spherical-geometry helpers.
//
// At runtime the geometry authority is the MapsGeometry Nitro module
// (android-maps-utils / GMSGeometryUtils). These TS mirrors exist for
// two reasons only:
//   1. Jest — the whole pipeline unit-tests in plain Node;
//   2. worklet-safe fallback when the native module is unavailable.
// They intentionally use the same mean-Earth-radius constant as
// Google's geometry libraries so both paths agree to sub-meter level.
//
// Zero dependencies. Every function is worklet-safe.
// ----------------------------------------------------------------

import type { LatLng } from "./types";

/** Mean Earth radius (meters) — same constant Google's geometry libs use. */
export const EARTH_RADIUS_M = 6371009;

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function toRadians(degrees: number): number {
  "worklet";
  return degrees * DEG2RAD;
}

export function toDegrees(radians: number): number {
  "worklet";
  return radians * RAD2DEG;
}

export function clamp(value: number, min: number, max: number): number {
  "worklet";
  return value < min ? min : value > max ? max : value;
}

/** Great-circle (haversine) distance between two points, in meters. */
export function computeDistanceBetween(a: LatLng, b: LatLng): number {
  "worklet";
  const phi1 = a.latitude * DEG2RAD;
  const phi2 = b.latitude * DEG2RAD;
  const dPhi = (b.latitude - a.latitude) * DEG2RAD;
  const dLambda = (b.longitude - a.longitude) * DEG2RAD;

  const sinPhi = Math.sin(dPhi / 2);
  const sinLambda = Math.sin(dLambda / 2);
  const h =
    sinPhi * sinPhi + Math.cos(phi1) * Math.cos(phi2) * sinLambda * sinLambda;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Normalizes any angle to the compass range [0, 360).
 *
 * NOTE: must stay ABOVE its worklet callers (computeHeading). The
 * Reanimated babel plugin rewrites `"worklet"` function declarations
 * into `var x = function …` assignments and captures same-module
 * helpers into the worklet closure at module-init time — a helper
 * defined later in the file is captured as `undefined` (hoisting is
 * lost). Jest does not run that plugin, so only the device catches it.
 */
export function normalizeHeading(degrees: number): number {
  "worklet";
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Initial bearing from `a` to `b`, in compass degrees [0, 360).
 * 0° = North, 90° = East.
 */
export function computeHeading(a: LatLng, b: LatLng): number {
  "worklet";
  const phi1 = a.latitude * DEG2RAD;
  const phi2 = b.latitude * DEG2RAD;
  const dLambda = (b.longitude - a.longitude) * DEG2RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalizeHeading(Math.atan2(y, x) * RAD2DEG);
}

/**
 * Signed shortest rotation from `from` to `to`, in degrees [-180, 180].
 * Positive = clockwise. E.g. 350° → 10° yields +20, never −340.
 */
export function shortestHeadingDelta(from: number, to: number): number {
  "worklet";
  let delta = (to - from) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}
