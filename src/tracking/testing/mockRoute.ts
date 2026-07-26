// ----------------------------------------------------------------
// Demo route used by the GPS trace generator and the tracking demo.
// Real-world polyline (~7 km) in the area the home map centers on.
// Coordinate data lives in fixtures/mock-route.json so the plain-node
// fixture generator (generateTraceFixture.js) can read the same file.
// ----------------------------------------------------------------

import type { LatLng } from "../types";
import { encodePolyline } from "../polyline";
import mockRouteJson from "./fixtures/mock-route.json";

export const MOCK_ROUTE_POINTS: readonly LatLng[] = mockRouteJson as LatLng[];

/**
 * Encoded (precision 5) form — what the app receives for a real trip.
 * Encoding snaps to the 1e-5° grid, same as production polylines.
 */
export const MOCK_ROUTE_ENCODED = encodePolyline(MOCK_ROUTE_POINTS);
