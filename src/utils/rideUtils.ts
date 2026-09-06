import {
  DriverFareSplit,
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

/**
 * Validates a `promotion` payload before any of it reaches the driver as a
 * cash instruction.
 *
 * Returns `null` — meaning "render this screen exactly as it renders on a
 * full-price ride" — unless the split is complete, non-negative, actually
 * carries a discount, and **adds up**. That last check mirrors the invariant
 * the server's constructor enforces by deriving `collect_from_rider` through
 * subtraction; re-checking it here is cheap because the value has crossed a
 * native JSON-string boundary and been through MMKV since then.
 *
 * A driver shown three figures that disagree is worse off than one shown none:
 * they cannot quote any of them at the roadside. Full price is also the safe
 * fallback — the driver never under-collects, and settlement still credits them
 * the full fare either way.
 */
export function normalizeDriverFareSplit(
  raw: unknown,
): DriverFareSplit | null {
  if (!raw || typeof raw !== "object") return null;
  const split = raw as Partial<DriverFareSplit>;

  const figures = [
    split.collect_from_rider,
    split.you_earn,
    split.platform_covers,
  ];
  if (
    figures.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  ) {
    return null;
  }

  const collect_from_rider = split.collect_from_rider as number;
  const you_earn = split.you_earn as number;
  const platform_covers = split.platform_covers as number;

  if (collect_from_rider < 0 || you_earn < 0 || platform_covers < 0) {
    return null;
  }
  // Nothing is being funded, so the split says nothing the fare does not.
  if (platform_covers === 0) return null;
  if (collect_from_rider + platform_covers !== you_earn) return null;

  return {
    collect_from_rider,
    you_earn,
    platform_covers,
    promotion_id: split.promotion_id,
    settled: split.settled === true,
  };
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
