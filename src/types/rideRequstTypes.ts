import { GeoPoint } from "~/utils/geo";

type Location = {
  area_code: string | null;
  building: string | null;
  city: string | null;
  country: string | null;
  door: string | null;
  extras: string | null;
  floor: string | null;
  geo_point: GeoPoint;
  instructions: string | null;
  place_id: string | null;
  road: string | null;
  street: string | null;
  ward: string | null;
};

type RiderDataInfo = {
  id: string;
  first_name: string;
  last_name: string;
  rating: number | null;
  total_rating_score: number | null;
  email: string;
  phone_number: string;
  mobile_country_code: string | null;
};

/**
 * What the driver collects in cash versus what the driver is paid, as the
 * server computed it.
 *
 * `you_earn` is the FULL fare and is never reduced by a promotion — Sitwego
 * funds the gap and credits it against the driver's subscription. Never derive
 * earnings from `collect_from_rider`; that is the mistake this shape exists to
 * prevent, which is why there is no `discounted_fare` field to reach for.
 */
type DriverFareSplit = {
  /** Cash the rider physically hands over at the end of the trip. */
  collect_from_rider: number;
  /** What the driver is paid — the full, undiscounted fare. */
  you_earn: number;
  /** `you_earn - collect_from_rider`. Sitwego's share, not a deduction. */
  platform_covers: number;
  /** The campaign funding this ride. Absent on a full-price ride. */
  promotion_id?: string;
  /**
   * False while the ride is in flight: the figures are the current best quote
   * and can still move if the fare does (an added stop reprices the ride).
   */
  settled: boolean;
};

type RideData = {
  distance: number;
  distance_to_pickup: number;
  duration_to_pickup: number;
  estimated_start_time: unknown;
  fare: number;
  id: string;
  msg: string;
  vc: string;
  search_request_id: string;
  search_request_valid_till: unknown;
  to: Location;
  from: Location;
  ride_line_str: GeoPoint[] | null;
  driver_to_pickup_line_str: GeoPoint[] | null;
  rider_info: RiderDataInfo | null;
  /** @see DriverFareSplit — absent on a full-price ride. */
  promotion?: DriverFareSplit;
  [key: string]: any;
};
type RideRequsetData = {
  from: Omit<Location, "geo_point"> & {
    geo_point: { lat: number; lon: number };
  };
  to: Omit<Location, "geo_point"> & {
    geo_point: { lat: number; lon: number };
  };
  distance: number;
  distance_to_pickup: number;
  duration_to_pickup: number;
  estimated_start_time: unknown;
  fare: number;
  id: string;
  msg: string;
  search_request_id: string;
  search_request_valid_till: unknown;
  ride_line_str: [number, number][] | null;
  driver_to_pickup_line_str: [number, number][] | null;
  /** @see DriverFareSplit — absent on a full-price ride. */
  promotion?: DriverFareSplit;
};

type RideRequsetNotification = {
  data: string; // JSON stringified RideRequsetData
  type: string;
  category: string;
  id: string;
  ttl: string;
  vc: string;
  /**
   * Wall-clock ms stamped natively when the offer arrived. Present on both the
   * live event and the replayed one, so the request timer can count down the
   * time that is actually left rather than restarting.
   */
  received_at?: number;
};

type RideNotificationType = {
  data: RideData;
  type: string;
  category: string;
  id: string;
  ttl?: string;
  /** @see RideRequsetNotification.received_at */
  received_at?: number;
  opened?: boolean;
  [key: string]: any;
};
export {
  DriverFareSplit,
  RideData,
  RiderDataInfo,
  Location,
  RideRequsetNotification,
  RideRequsetData,
  RideNotificationType,
};

export type RideEventType =
  | "RideCancelEvent"
  | "RideStartEvent"
  | "RideEndEvent"
  | "DriverArrivedEvent"
  | "FareChange"
  | "LocationUpdateEvent";
export type RideEvent = {
  event_id: string;
  timestamp: number;
  eventType: RideEventType;
  ride_id: string;
  driver_id: string;
  rider_id: string;
  eventPayload?: { [key: string]: any };
};
