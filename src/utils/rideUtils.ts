import {
  RideData,
  RideRequsetData,
  RideRequsetNotification,
} from "~/types/rideRequstTypes";

import { GeoPoint } from "./geo";

/**
 * How long a driver has to act on a ride request, in seconds. Drives both the
 * in-app countdown bar and the cut-off for replaying an offer that arrived
 * while the app was killed.
 */
export const RIDE_REQUEST_TTL_SEC = 20;

/**
 * Seconds left on a ride request given when it arrived.
 *
 * A missing `receivedAt` means the offer came straight off the live native
 * event with no timestamp (older payload shape), so it gets the full window.
 * A result of `0` means the offer is dead and must not be shown.
 */
export function rideRequestRemainingSec(
  receivedAt?: number,
  now: number = Date.now(),
): number {
  if (!receivedAt) return RIDE_REQUEST_TTL_SEC;
  const elapsedSec = (now - receivedAt) / 1000;
  // Upper clamp guards against device clock skew handing out a window longer
  // than the driver actually has.
  return Math.min(
    RIDE_REQUEST_TTL_SEC,
    Math.max(0, RIDE_REQUEST_TTL_SEC - elapsedSec),
  );
}

export function parseRideRequestData({
  data,
  ...rest
}: RideRequsetNotification) {
  try {
    const parsedData: RideRequsetData = JSON.parse(data);
    return {
      ...rest,
      data: parsedData,
    };
  } catch (error) {
    console.error("Failed to parse ride request data:", error);
    return {
      ...rest,
      data: null,
    };
  }
}
export function convert_array_to_polyline(
  arr: [number, number][] | null,
): GeoPoint[] | null {
  if (!arr || arr.length === 0) return null;
  return arr.map(([longitude, latitude]) => ({ longitude, latitude }));
}

export function formatedRideData(rideData: RideRequsetData): RideData {
  const ride_line_str = convert_array_to_polyline(rideData.ride_line_str);
  const driver_to_pickup_line_str = convert_array_to_polyline(
    rideData.driver_to_pickup_line_str,
  );
  return {
    ...rideData,
    ride_line_str,
    driver_to_pickup_line_str,
    from: {
      ...rideData.from,
      geo_point: {
        latitude: rideData.from.geo_point.lat,
        longitude: rideData.from.geo_point.lon,
      },
    },
    to: {
      ...rideData.to,
      geo_point: {
        latitude: rideData.to.geo_point.lat,
        longitude: rideData.to.geo_point.lon,
      },
    },
  };
}
