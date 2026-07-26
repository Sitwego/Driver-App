// ----------------------------------------------------------------
// Route geometry: the 1-D "distance along route" model.
//
// A route is preprocessed ONCE into a RouteTable (plain parallel
// arrays — see types.ts). At runtime that preprocessing is done by
// the MapsGeometry Nitro module (android-maps-utils); the TS
// implementations here are the Jest reference + worklet fallback and
// must stay numerically interchangeable with the native ones.
//
// Hot path: `pointAtInto` converts d → (lat, lng, bearing) at frame
// rate (60 Hz). It is pure array math — binary search + one linear
// interpolation — allocates nothing, and never crosses a bridge.
// Linear lat/lng interpolation (instead of spherical) is deliberate:
// route segments are tens of meters, where the error is sub-centimeter.
// ----------------------------------------------------------------

import {
  clamp,
  computeDistanceBetween,
  computeHeading,
  EARTH_RADIUS_M,
} from "./geo";
import { decodePolyline } from "./polyline";

import type {
  IndexWindow,
  LatLng,
  PathProjection,
  RoutePoint,
  RouteTable,
} from "./types";

const DEG2RAD = Math.PI / 180;

// ----------------------------------------------------------------
// Preprocessing (one-time per route/leg)
// ----------------------------------------------------------------

/**
 * Builds the RouteTable from decoded vertices. Consecutive duplicate
 * points are dropped — zero-length segments break projection math.
 *
 * @throws if fewer than 2 distinct points remain.
 */
export function buildRouteTable(points: readonly LatLng[]): RouteTable {
  const lats: number[] = [];
  const lngs: number[] = [];
  for (const p of points) {
    const last = lats.length - 1;
    if (last >= 0 && lats[last] === p.latitude && lngs[last] === p.longitude) {
      continue;
    }
    lats.push(p.latitude);
    lngs.push(p.longitude);
  }

  const n = lats.length;
  if (n < 2) {
    throw new Error(
      `buildRouteTable: route needs at least 2 distinct points, got ${n}`,
    );
  }

  // Annotated form (not `new Array<number>`): the installed
  // @babel/preset-typescript fails to strip NewExpression generics.
  const cumDist: number[] = new Array(n);
  const bearings: number[] = new Array(n);
  cumDist[0] = 0;
  const a: LatLng = { latitude: 0, longitude: 0 };
  const b: LatLng = { latitude: 0, longitude: 0 };
  for (let i = 1; i < n; i++) {
    a.latitude = lats[i - 1];
    a.longitude = lngs[i - 1];
    b.latitude = lats[i];
    b.longitude = lngs[i];
    cumDist[i] = cumDist[i - 1] + computeDistanceBetween(a, b);
    bearings[i - 1] = computeHeading(a, b);
  }
  // Repeat the last segment bearing so bearings[n-1] is always defined.
  bearings[n - 1] = bearings[n - 2];

  return { lats, lngs, cumDist, bearings, totalLength: cumDist[n - 1] };
}

/**
 * Pure-TS route preprocessing from a Google encoded polyline
 * (precision 5). Mirrors MapsGeometry.prepareRoute exactly.
 */
export function prepareRouteTS(encodedPolyline: string): RouteTable {
  return buildRouteTable(decodePolyline(encodedPolyline));
}

// ----------------------------------------------------------------
// Frame-rate path: d → (lat, lng, bearing)
// ----------------------------------------------------------------

/**
 * Binary search: index of the last vertex with cumDist[i] <= d.
 * Returns at most n-2 so [i, i+1] is always a valid segment.
 */
export function segmentIndexForDistance(table: RouteTable, d: number): number {
  "worklet";
  const cumDist = table.cumDist;
  let lo = 0;
  let hi = cumDist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cumDist[mid] <= d) lo = mid;
    else hi = mid - 1;
  }
  return lo >= cumDist.length - 1 ? cumDist.length - 2 : lo;
}

/**
 * Converts distance-along-route (meters) into position + bearing,
 * writing into `out` (zero allocation — this runs at 60 Hz).
 * `d` is clamped to [0, totalLength]. Returns `out`.
 */
export function pointAtInto(
  table: RouteTable,
  d: number,
  out: RoutePoint,
): RoutePoint {
  "worklet";
  const dClamped = d < 0 ? 0 : d > table.totalLength ? table.totalLength : d;
  const i = segmentIndexForDistance(table, dClamped);
  const segLen = table.cumDist[i + 1] - table.cumDist[i];
  const t = segLen > 0 ? (dClamped - table.cumDist[i]) / segLen : 0;

  out.lat = table.lats[i] + (table.lats[i + 1] - table.lats[i]) * t;
  out.lng = table.lngs[i] + (table.lngs[i + 1] - table.lngs[i]) * t;
  out.bearing = table.bearings[i];
  return out;
}

/** Allocating convenience wrapper around `pointAtInto` — never per-frame. */
export function pointAt(table: RouteTable, d: number): RoutePoint {
  "worklet";
  return pointAtInto(table, d, { lat: 0, lng: 0, bearing: 0 });
}

/**
 * Splits the route at distance `d` into the traveled part (behind the
 * vehicle, rendered dimmed) and the part ahead (brand green). Both
 * halves include the interpolated split point so the polylines join
 * seamlessly. Allocates — call at low frequency (≤ 2×/s per spec),
 * never per frame.
 */
export function splitRouteAt(
  table: RouteTable,
  d: number,
): { behind: LatLng[]; ahead: LatLng[] } {
  const { lats, lngs, cumDist } = table;
  const dClamped = clamp(d, 0, table.totalLength);
  const i = segmentIndexForDistance(table, dClamped);
  const segLen = cumDist[i + 1] - cumDist[i];
  const t = segLen > 0 ? (dClamped - cumDist[i]) / segLen : 0;
  const split: LatLng = {
    latitude: lats[i] + (lats[i + 1] - lats[i]) * t,
    longitude: lngs[i] + (lngs[i + 1] - lngs[i]) * t,
  };

  const behind: LatLng[] = [];
  for (let k = 0; k <= i; k++) {
    behind.push({ latitude: lats[k], longitude: lngs[k] });
  }
  behind.push(split);

  const ahead: LatLng[] = [split];
  for (let k = i + 1; k < lats.length; k++) {
    ahead.push({ latitude: lats[k], longitude: lngs[k] });
  }
  return { behind, ahead };
}

// ----------------------------------------------------------------
// Search-window helpers
// ----------------------------------------------------------------

/**
 * Maps the distance window [dCenter - behindM, dCenter + aheadM] to an
 * inclusive vertex index range, clamped to the route bounds (short
 * routes clamp — they never wrap).
 */
export function windowIndexRange(
  table: RouteTable,
  dCenter: number,
  behindM: number,
  aheadM: number,
): IndexWindow {
  "worklet";
  const from = clamp(dCenter - behindM, 0, table.totalLength);
  const to = clamp(dCenter + aheadM, 0, table.totalLength);
  return {
    startIdx: segmentIndexForDistance(table, from),
    endIdx: segmentIndexForDistance(table, to),
  };
}

/** Full-route window (used for the very first fix and re-acquire). */
export function fullIndexRange(table: RouteTable): IndexWindow {
  "worklet";
  return { startIdx: 0, endIdx: table.lats.length - 2 };
}

// ----------------------------------------------------------------
// Projection (per accepted fix, ~1 Hz — allocation is fine here)
// ----------------------------------------------------------------

/**
 * Pure-TS segment-constrained nearest-point projection. Mirrors
 * MapsGeometry.projectOnPath (which delegates to android-maps-utils).
 *
 * Works in a local equirectangular frame centered on the query point:
 * at search-window scale (≤ 1 km) the planar approximation is exact to
 * well under a millimeter of the spherical result.
 *
 * `startIdx`/`endIdx` are inclusive SEGMENT indices (segment i is
 * points[i] → points[i+1]).
 */
export function projectOnPathTS(
  table: RouteTable,
  lat: number,
  lng: number,
  startIdx: number,
  endIdx: number,
): PathProjection {
  const { lats, lngs, cumDist } = table;
  const lastSegment = lats.length - 2;
  const s0 = clamp(Math.floor(startIdx), 0, lastSegment);
  const s1 = clamp(Math.floor(endIdx), s0, lastSegment);

  // Local planar frame: meters east/north of the query point.
  const metersPerRadLat = EARTH_RADIUS_M;
  const metersPerRadLng = EARTH_RADIUS_M * Math.cos(lat * DEG2RAD);

  let bestDistSq = Infinity;
  let bestSegment = s0;
  let bestT = 0;

  let ax = (lngs[s0] - lng) * DEG2RAD * metersPerRadLng;
  let ay = (lats[s0] - lat) * DEG2RAD * metersPerRadLat;

  for (let i = s0; i <= s1; i++) {
    const bx = (lngs[i + 1] - lng) * DEG2RAD * metersPerRadLng;
    const by = (lats[i + 1] - lat) * DEG2RAD * metersPerRadLat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    // Nearest point on segment AB to the origin (the query point).
    const t = lenSq > 0 ? clamp(-(ax * dx + ay * dy) / lenSq, 0, 1) : 0;
    const px = ax + dx * t;
    const py = ay + dy * t;
    const distSq = px * px + py * py;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestSegment = i;
      bestT = t;
    }

    ax = bx;
    ay = by;
  }

  const segLen = cumDist[bestSegment + 1] - cumDist[bestSegment];
  return {
    d: cumDist[bestSegment] + segLen * bestT,
    perpendicularM: Math.sqrt(bestDistSq),
    segmentIndex: bestSegment,
  };
}
