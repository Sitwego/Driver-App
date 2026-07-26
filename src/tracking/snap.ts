// ----------------------------------------------------------------
// Step 3 — Snap-to-polyline.
//
// Stateful snapper sitting between the ingest gate and the motion
// model. Turns accepted fixes into a monotonically non-decreasing
// distance-along-route `d`, and owns the off-route state machine.
//
// Projection is delegated to the geometry provider (MapsGeometry
// Nitro module at runtime, pure-TS mirror under Jest) — one native
// call per accepted fix, never per frame.
//
// Pure TS, no react-native imports, deterministic given the fix
// stream (no wall-clock reads).
// ----------------------------------------------------------------

import { computeDistanceBetween } from "./geo";
import { getGeometryProvider, type GeometryProvider } from "./mapsGeometry";
import { fullIndexRange, pointAtInto, windowIndexRange } from "./routeGeometry";
import type { LocationFix, RoutePoint, RouteTable } from "./types";

export type SnapStatus = "snapped" | "off_route";

/** The slice of a fix the snapper reads — both LocationFix and AcceptedFix satisfy it. */
export type SnapInput = Pick<LocationFix, "lat" | "lng">;

export interface SnapResult {
  status: SnapStatus;
  /**
   * Distance along the route, meters. Monotonically non-decreasing while
   * snapped; frozen at the last snapped value while off-route. Re-acquiring
   * after off-route resets the baseline (see NOTES.md) — that single
   * discontinuity is smoothed by the motion model, not hidden here.
   */
  d: number;
  /** Position to render: the on-route point at `d` when snapped, the raw fix while off-route. */
  lat: number;
  lng: number;
  /** Route tangent at `d` when snapped; null while off-route (no route authority there). */
  bearing: number | null;
  /** Perpendicular distance of the raw fix from the route, meters. */
  perpendicularM: number;
  /** Route segment the fix projected onto (diagnostic / dev overlay). */
  segmentIndex: number;
}

export interface SnapperOptions {
  /**
   * Motorcycles legitimately leave the road network, so 'boda' widens the
   * off-route threshold to 45 m (default 30 m). Any other value = default.
   */
  rideType?: string;
  /** Perpendicular distance that counts as "far from route", meters. */
  offRouteThresholdM?: number;
  /** Consecutive far fixes before declaring off-route. */
  offRouteAfterFixes?: number;
  /** Perpendicular distance that counts as "back on route", meters. */
  reacquireThresholdM?: number;
  /** Consecutive near fixes before snapping back. */
  reacquireAfterFixes?: number;
  /** Search window behind the last snapped d, meters. */
  behindWindowM?: number;
  /** Search window ahead of the last snapped d, meters. */
  aheadWindowM?: number;
  /** Injected geometry provider (tests); defaults to the runtime provider. */
  geometry?: GeometryProvider;
}

const BODA_OFF_ROUTE_THRESHOLD_M = 45;

const DEFAULTS = {
  offRouteThresholdM: 30,
  offRouteAfterFixes: 5,
  reacquireThresholdM: 20,
  reacquireAfterFixes: 3,
  behindWindowM: 100,
  aheadWindowM: 500,
} as const;

export class Snapper {
  private readonly table: RouteTable;
  private readonly geometry: GeometryProvider;
  private readonly opts: Required<Omit<SnapperOptions, "rideType" | "geometry">>;

  /** null until the first fix (full-route acquisition). */
  private d: number | null = null;
  private offRoute = false;
  private farStreak = 0;
  private nearStreak = 0;
  /** Raw movement accumulated while off-route — bounds how far along the route the vehicle can have gotten. */
  private offRouteTravelM = 0;
  private lastRawLat = 0;
  private lastRawLng = 0;
  /** Scratch output for pointAtInto (the snapper itself is cold-path, but stay allocation-light). */
  private readonly scratch: RoutePoint = { lat: 0, lng: 0, bearing: 0 };

  constructor(table: RouteTable, options: SnapperOptions = {}) {
    this.table = table;
    this.geometry = options.geometry ?? getGeometryProvider();
    this.opts = {
      offRouteThresholdM:
        options.offRouteThresholdM ??
        (options.rideType === "boda"
          ? BODA_OFF_ROUTE_THRESHOLD_M
          : DEFAULTS.offRouteThresholdM),
      offRouteAfterFixes: options.offRouteAfterFixes ?? DEFAULTS.offRouteAfterFixes,
      reacquireThresholdM:
        options.reacquireThresholdM ?? DEFAULTS.reacquireThresholdM,
      reacquireAfterFixes:
        options.reacquireAfterFixes ?? DEFAULTS.reacquireAfterFixes,
      behindWindowM: options.behindWindowM ?? DEFAULTS.behindWindowM,
      aheadWindowM: options.aheadWindowM ?? DEFAULTS.aheadWindowM,
    };
  }

  /** Current status without pushing a fix. */
  get status(): SnapStatus {
    return this.offRoute ? "off_route" : "snapped";
  }

  /** Last snapped d, or null before the first fix. */
  get currentD(): number | null {
    return this.d;
  }

  /** Drops all state — new trip, new leg, or replay restart. */
  reset(): void {
    this.d = null;
    this.offRoute = false;
    this.farStreak = 0;
    this.nearStreak = 0;
    this.offRouteTravelM = 0;
  }

  push(fix: SnapInput): SnapResult {
    if (this.d === null) {
      return this.acquire(fix);
    }
    return this.offRoute ? this.pushOffRoute(fix) : this.pushSnapped(fix);
  }

  /** First fix: full-route search, no monotonic history yet. */
  private acquire(fix: SnapInput): SnapResult {
    const w = fullIndexRange(this.table);
    const proj = this.project(fix, w.startIdx, w.endIdx);
    this.d = proj.d;
    this.farStreak = proj.perpendicularM > this.opts.offRouteThresholdM ? 1 : 0;
    this.trackRaw(fix, false);
    return this.snappedResult(proj.perpendicularM, proj.segmentIndex);
  }

  private pushSnapped(fix: SnapInput): SnapResult {
    const o = this.opts;
    const w = windowIndexRange(this.table, this.d!, o.behindWindowM, o.aheadWindowM);
    const proj = this.project(fix, w.startIdx, w.endIdx);

    if (proj.perpendicularM > o.offRouteThresholdM) {
      this.farStreak += 1;
      if (this.farStreak >= o.offRouteAfterFixes) {
        // Confirmed off-route: freeze d, start passing raw fixes through.
        this.offRoute = true;
        this.nearStreak = 0;
        this.offRouteTravelM = 0;
        this.trackRaw(fix, false);
        return this.offRouteResult(fix, proj.perpendicularM, proj.segmentIndex);
      }
    } else {
      this.farStreak = 0;
    }

    // Monotonic clamp: a projection behind the current d (GPS noise pulling
    // backward) pins to the current d — the marker never moves backward.
    if (proj.d > this.d!) {
      this.d = proj.d;
    }
    this.trackRaw(fix, false);
    return this.snappedResult(proj.perpendicularM, proj.segmentIndex);
  }

  private pushOffRoute(fix: SnapInput): SnapResult {
    const o = this.opts;
    this.trackRaw(fix, true);

    // Re-acquire search widens with the raw distance actually traveled while
    // off-route — the vehicle cannot have advanced along the route by more
    // than it physically moved.
    const w = windowIndexRange(
      this.table,
      this.d!,
      o.behindWindowM + this.offRouteTravelM,
      o.aheadWindowM + this.offRouteTravelM,
    );
    const proj = this.project(fix, w.startIdx, w.endIdx);

    if (proj.perpendicularM <= o.reacquireThresholdM) {
      this.nearStreak += 1;
      if (this.nearStreak >= o.reacquireAfterFixes) {
        // Back on route: re-acquire at the fresh projection. This resets the
        // monotonic baseline (the detour may rejoin behind the frozen d).
        this.offRoute = false;
        this.farStreak = 0;
        this.nearStreak = 0;
        this.offRouteTravelM = 0;
        this.d = proj.d;
        return this.snappedResult(proj.perpendicularM, proj.segmentIndex);
      }
    } else {
      this.nearStreak = 0;
    }

    return this.offRouteResult(fix, proj.perpendicularM, proj.segmentIndex);
  }

  private project(fix: SnapInput, startIdx: number, endIdx: number) {
    return this.geometry.projectOnPath(this.table, fix.lat, fix.lng, startIdx, endIdx);
  }

  /** Remembers the raw position, accumulating travel distance while off-route. */
  private trackRaw(fix: SnapInput, accumulate: boolean): void {
    if (accumulate) {
      this.offRouteTravelM += computeDistanceBetween(
        { latitude: this.lastRawLat, longitude: this.lastRawLng },
        { latitude: fix.lat, longitude: fix.lng },
      );
    }
    this.lastRawLat = fix.lat;
    this.lastRawLng = fix.lng;
  }

  private snappedResult(perpendicularM: number, segmentIndex: number): SnapResult {
    const p = pointAtInto(this.table, this.d!, this.scratch);
    return {
      status: "snapped",
      d: this.d!,
      lat: p.lat,
      lng: p.lng,
      bearing: p.bearing,
      perpendicularM,
      segmentIndex,
    };
  }

  private offRouteResult(
    fix: SnapInput,
    perpendicularM: number,
    segmentIndex: number,
  ): SnapResult {
    return {
      status: "off_route",
      d: this.d!,
      lat: fix.lat,
      lng: fix.lng,
      bearing: null,
      perpendicularM,
      segmentIndex,
    };
  }
}
