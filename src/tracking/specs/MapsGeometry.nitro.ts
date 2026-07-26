// ----------------------------------------------------------------
// Nitro spec for the MapsGeometry hybrid object.
//
// Android: Kotlin implementation wrapping android-maps-utils
//   (PolyUtil / SphericalUtil) — the geometry authority.
// iOS: not implemented yet (Android-first; mirror with
//   Google-Maps-iOS-Utils' GMSGeometryUtils behind this same spec).
//
// Threading contract: these methods are one-time preprocessing
// (prepareRoute) and per-accepted-fix work (projectOnPath, ~1 Hz).
// Nothing here is ever called per frame — the 60 Hz path is
// pointAtInto() in routeGeometry.ts, pure TS over the returned table.
// ----------------------------------------------------------------

import type { HybridObject } from "react-native-nitro-modules";

/** Mirrors RouteTable in src/tracking/types.ts (kept in sync manually). */
export interface NativeRouteTable {
  lats: number[];
  lngs: number[];
  cumDist: number[];
  bearings: number[];
  totalLength: number;
}

/** Mirrors PathProjection in src/tracking/types.ts. */
export interface NativePathProjection {
  d: number;
  perpendicularM: number;
  segmentIndex: number;
}

export interface MapsGeometry
  extends HybridObject<{ android: "kotlin" }> {
  /**
   * Decodes the polyline (precision 5), dedupes zero-length segments and
   * precomputes cumulative distances + per-segment bearings. The instance
   * keeps the decoded vertices so projectOnPath needs no arrays passed in.
   */
  prepareRoute(encodedPolyline: string): NativeRouteTable;

  /**
   * Segment-constrained nearest-point projection of (lat, lng) onto the
   * route prepared by the last prepareRoute call. startIdx/endIdx are
   * inclusive segment indices bounding the search window.
   *
   * @throws if prepareRoute has not been called on this instance.
   */
  projectOnPath(
    lat: number,
    lng: number,
    startIdx: number,
    endIdx: number,
  ): NativePathProjection;
}
