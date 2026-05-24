// ------------------------------------------------------------------
// Geo functions
// ------------------------------------------------------------------
import * as Location from "expo-location";
export type GeoPoint = {
  latitude: number;
  longitude: number;
};
export type GpsData = {
  geo_point: GeoPoint;
  accuracy?: number;
  heading?: number;
  bearing?: number;
  pitch?: number;
  speed?: number;
  altitude?: number;
};

export type OnGpsData = {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  distance: number;
  bearing: number;
  altitude: number;
  isMoving: boolean;
};
export function sphericalCosinesDistance(
  pos1: GeoPoint,
  pos2: GeoPoint,
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (pos1.latitude * Math.PI) / 180;
  const φ2 = (pos2.latitude * Math.PI) / 180;
  const Δλ = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

  return (
    Math.acos(
      Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(Δλ),
    ) * R
  );
}
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters >= 1000) {
    return `${Math.floor(distanceInMeters / 1000)}Km`;
  } else if (distanceInMeters > 0) {
    return `${distanceInMeters}M`;
  } else {
    return "0";
  }
}

// Haversine distance (meters)
export function haversineDistance(pos1: GeoPoint, pos2: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (pos1.latitude * Math.PI) / 180;
  const φ2 = (pos2.latitude * Math.PI) / 180;
  const Δφ = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
  const Δλ = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bearing in radians from point a to b
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const φ1 = (a.latitude * Math.PI) / 180;
  const λ1 = (a.longitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const λ2 = (b.longitude * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return Math.atan2(y, x);
}

// Compute the perpendicular (cross-track) distance (meters)
// from point p to the segment between points a and b.
export function minimalDistanceToSegment(
  p: GeoPoint,
  a: GeoPoint,
  b: GeoPoint,
): number {
  const R = 6371e3; // Earth's radius in meters
  const dAB = haversineDistance(a, b);
  if (dAB === 0) return haversineDistance(p, a);

  const dAP = haversineDistance(a, p);
  const dBP = haversineDistance(b, p);

  // Compute bearings (in radians)
  const θAB = bearing(a, b);
  const θAP = bearing(a, p);
  const Δθ = θAP - θAB;

  // Angular distance from a to p (in radians)
  const δAP = dAP / R;
  // Perpendicular (cross-track) distance
  const dxt = Math.abs(Math.asin(Math.sin(δAP) * Math.sin(Δθ)) * R);

  // Compute along-track distance (projected distance from a)
  const δxt = dxt / R;
  const alongTrackDistance = Math.acos(Math.cos(δAP) / Math.cos(δxt)) * R;

  // If projection falls outside the segment, return the nearest endpoint distance.
  if (alongTrackDistance < 0) return dAP;
  if (alongTrackDistance > dAB) return dBP;

  // Otherwise, return the perpendicular distance.
  return dxt;
}

// Find the best insertion index for newCoord in the current route.
// The index is chosen based on the smallest perpendicular distance
// from newCoord to each segment of the route.

export function findInsertionIndexAndClosestPoint(
  route: GeoPoint[],
  newCoord: GeoPoint,
): { insertionIndex: number; minPointDistance: number } {
  // Default: if route has less than 2 points, insertionIndex will be at the end.
  let insertionIndex = route.length;
  let minSegmentDistance = Infinity;
  let minPointDistance = Infinity;

  // Loop over each point in the route
  for (let i = 0; i < route.length; i++) {
    // Update the closest point distance
    const pointDistance = sphericalCosinesDistance(newCoord, route[i]);
    if (pointDistance < minPointDistance) {
      minPointDistance = pointDistance;
    }

    // For segments: only if there's a next point
    if (i < route.length - 1) {
      const segmentDistance = minimalDistanceToSegment(
        newCoord,
        route[i],
        route[i + 1],
      );
      if (segmentDistance < minSegmentDistance) {
        minSegmentDistance = segmentDistance;
        // Insertion index is set to insert the new point between route[i] and route[i+1]
        insertionIndex = i + 1;
      }
    }
  }

  return { insertionIndex, minPointDistance };
}

/**
 * Projects `position` onto the closest segment of `polyline` and returns the
 * snapped coordinate. Returns null if the polyline has fewer than 2 points.
 */
export function snapToPolyline(
  position: GeoPoint,
  polyline: GeoPoint[],
): GeoPoint | null {
  if (polyline.length < 2) return null;

  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = minimalDistanceToSegment(position, polyline[i], polyline[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  const a = polyline[bestIndex];
  const b = polyline[bestIndex + 1];
  return _projectOntoSegment(position, a, b);
}

function _projectOntoSegment(p: GeoPoint, a: GeoPoint, b: GeoPoint): GeoPoint {
  const R = 6371e3;
  const dAB = haversineDistance(a, b);
  if (dAB === 0) return a;

  const dAP = haversineDistance(a, p);
  const θAB = bearing(a, b);
  const θAP = bearing(a, p);
  const δAP = dAP / R;
  const Δθ = θAP - θAB;

  const dxt = Math.asin(Math.sin(δAP) * Math.sin(Δθ)) * R;
  const δxt = Math.abs(dxt) / R;
  const cosδxt = Math.cos(δxt);
  const alongTrack = cosδxt < 1e-10 ? 0 : Math.acos(Math.cos(δAP) / cosδxt) * R;

  const d = Math.max(0, Math.min(dAB, isNaN(alongTrack) ? 0 : alongTrack));
  const δ = d / R;

  const φ1 = (a.latitude * Math.PI) / 180;
  const λ1 = (a.longitude * Math.PI) / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θAB),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θAB) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );

  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Returns the bearing (0-360°) of the polyline segment closest to `position`.
 * Returns null if the polyline has fewer than 2 points.
 */
export function getPolylineBearing(
  position: GeoPoint,
  polyline: GeoPoint[],
): number | null {
  if (polyline.length < 2) return null;

  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = minimalDistanceToSegment(position, polyline[i], polyline[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  return getMarkerRotation(polyline[bestIndex], polyline[bestIndex + 1]);
}

/**
 * Calculates the bearing between two geographic coordinates.
 * The returned angle (in degrees) can be used to rotate a marker along a polyline.
 *
 * @param start - The starting coordinate.
 * @param end - The ending coordinate.
 * @returns The bearing angle in degrees (0-360), where 0° points North.
 */
export function getMarkerRotation(start: GeoPoint, end: GeoPoint): number {
  // Convert degrees to radians
  const startLatRad = start.latitude * (Math.PI / 180);
  const startLngRad = start.longitude * (Math.PI / 180);
  const endLatRad = end.latitude * (Math.PI / 180);
  const endLngRad = end.longitude * (Math.PI / 180);

  // Calculate differences
  const deltaLng = endLngRad - startLngRad;

  // Compute the components of the formula
  const y = Math.sin(deltaLng) * Math.cos(endLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(endLatRad) -
    Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(deltaLng);

  // Calculate the initial bearing (in radians)
  let bearing = Math.atan2(y, x);

  // Convert the bearing from radians to degrees
  bearing = (bearing * 180) / Math.PI;

  // Normalize the bearing to 0-360 degrees
  return (bearing + 360) % 360;
}

export function getRotation(start: GeoPoint, end: GeoPoint): number {
  const latDifference = Math.abs(start.latitude - end.latitude);
  const lngDifference = Math.abs(start.longitude - end.longitude);
  let rotation = -1;

  // Helper: convert radians to degrees
  const toDegrees = (radians: number) => radians * (180 / Math.PI);

  if (start.latitude < end.latitude && start.longitude < end.longitude) {
    rotation = toDegrees(Math.atan(lngDifference / latDifference));
  } else if (
    start.latitude >= end.latitude &&
    start.longitude < end.longitude
  ) {
    rotation = 90 - toDegrees(Math.atan(lngDifference / latDifference)) + 90;
  } else if (
    start.latitude >= end.latitude &&
    start.longitude >= end.longitude
  ) {
    rotation = toDegrees(Math.atan(lngDifference / latDifference)) + 180;
  } else if (
    start.latitude < end.latitude &&
    start.longitude >= end.longitude
  ) {
    rotation = 90 - toDegrees(Math.atan(lngDifference / latDifference)) + 270;
  }

  return rotation;
}

/**
 * Derives a camera tilt angle from zoom level.
 * Flat at zoom ≤ 12 (route overview), full tilt (60°) at zoom ≥ 18 (street navigation).
 */
export function calcDynamicPitch(zoom: number): number {
  const t = Math.min(Math.max((zoom - 12) / (18 - 12), 0), 1);
  return t * 60;
}

export const getDynamicBuffer = (acc: number) => {
  // 1 degree ≈ 111,000 meters
  const bufferDegrees = acc / 111000;
  // Keep buffer between 0.0001° (~11m) and 0.01° (~1.1km)
  return Math.min(Math.max(bufferDegrees, 0.0001), 0.01);
};

function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Location timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

export async function getLocationAsync() {
  try {
    const lastKnown = await raceTimeout(
      Location.getLastKnownPositionAsync({
        maxAge: 30_000,
        requiredAccuracy: 200,
      }),
      3_000,
    );
    if (lastKnown) return lastKnown;
  } catch {}
  return raceTimeout(
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    }),
    8_000,
  );
}
