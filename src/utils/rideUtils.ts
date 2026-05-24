import {
  RideData,
  RideRequsetData,
  RideRequsetNotification,
} from "~/types/rideRequstTypes";
import { GeoPoint } from "./geo";

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
