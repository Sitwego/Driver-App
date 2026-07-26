// ----------------------------------------------------------------
// Runtime geometry provider.
//
// Prefers the MapsGeometry Nitro module (android-maps-utils — the
// geometry authority per spec). Falls back to the numerically
// interchangeable pure-TS implementation when the native module is
// unavailable: Jest, iOS (until the GMSGeometryUtils mirror lands),
// or a build where the .so failed to load.
//
// Both operations here are cold-path: once per route (prepareRoute)
// and once per accepted fix (projectOnPath). Never call per frame.
// ----------------------------------------------------------------

import type { PathProjection, RouteTable } from "./types";
import { prepareRouteTS, projectOnPathTS } from "./routeGeometry";
import type { MapsGeometry } from "./specs/MapsGeometry.nitro";

export interface GeometryProvider {
  /** Which implementation is active — surfaced on the dev screen. */
  readonly kind: "native" | "ts";
  prepareRoute(encodedPolyline: string): RouteTable;
  projectOnPath(
    table: RouteTable,
    lat: number,
    lng: number,
    startIdx: number,
    endIdx: number,
  ): PathProjection;
}

function createNativeProvider(): GeometryProvider | null {
  try {
    // Dynamic require: keeps Jest (plain Node) free of native imports.
    const { NitroModules } =
      require("react-native-nitro-modules") as typeof import("react-native-nitro-modules");
    const native = NitroModules.createHybridObject<MapsGeometry>("MapsGeometry");
    return {
      kind: "native",
      prepareRoute: (encodedPolyline) => native.prepareRoute(encodedPolyline),
      // `table` is ignored: the hybrid object keeps the decoded route from
      // its prepareRoute call, so per-fix calls cross the JSI boundary with
      // scalars only.
      projectOnPath: (_table, lat, lng, startIdx, endIdx) =>
        native.projectOnPath(lat, lng, startIdx, endIdx),
    };
  } catch {
    return null;
  }
}

const tsProvider: GeometryProvider = {
  kind: "ts",
  prepareRoute: prepareRouteTS,
  projectOnPath: (table, lat, lng, startIdx, endIdx) =>
    projectOnPathTS(table, lat, lng, startIdx, endIdx),
};

let cached: GeometryProvider | null = null;

/**
 * Returns the active geometry provider. Each call to prepareRoute on the
 * returned provider replaces the route held by the shared native instance —
 * one tracked vehicle/route at a time, which matches the trip screen.
 */
export function getGeometryProvider(): GeometryProvider {
  if (cached === null) {
    cached = createNativeProvider() ?? tsProvider;
  }
  return cached;
}

/** Test-only: force the pure-TS provider (or reset with null). */
export function __setGeometryProviderForTests(
  provider: GeometryProvider | null,
): void {
  cached = provider;
}
