import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  useRideRequest,
  useRideRequestStatus,
  initialRideStatus,
} from "~/lib/Providers/UseRideRequestProvider";
import { useUserState } from "~/lib/state/userState";
import { locationStore, rideStore } from "~/lib/store";
import { RideNotificationType } from "~/types/rideRequstTypes";
import { GeoPoint, getLocationAsync } from "~/utils/geo";

import { useApiClient } from "./useApiClient";

/**
 * Server response to accepting a ride request. `pickup_fare` is the
 * approach-leg fare (KES) the server locked for this driver at accept time —
 * authoritative and not client-derived.
 */
export type AcceptRideRequestResponse = {
  pickup_location: { lat: number; lon: number } | unknown;
  polyline: [number, number][] | null;
  pickup_fare: number;
};

export function useAcceptRideRequestMutation() {
  const { makeApiCall } = useApiClient();
  return useMutation({
    async mutationFn({
      ride_id,
      from,
      to,
      vc,
    }: {
      ride_id: string;
      from: GeoPoint;
      to: GeoPoint;
      vc?: string;
    }) {
      return await makeApiCall<AcceptRideRequestResponse>({
        url: `accept-ride-request/${ride_id}/${vc!}/accept`,
        data: {
          from: {
            geo_point: {
              lat: from.latitude,
              lon: from.longitude,
            },
          },
          to: {
            geo_point: {
              lat: to.latitude,
              lon: from.longitude,
            },
          },
        },
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    async onSuccess(data: any) {},
    onError(error, variables, context) {
      console.log(error);
    },
    retry(failureCount, error) {
      if (error instanceof Error) {
        console.warn(
          `Accept ride request failed. Attempt ${failureCount}. Error: ${error.message}`,
        );
      } else {
        console.warn(
          `Accept ride request failed. Attempt ${failureCount}. Error: ${error}`,
        );
      }
      return failureCount < 3;
    },
  });
}
export function useCreateRideRequestMutation() {
  const { rideState } = useRideRequest();
  const { makeApiCall } = useApiClient();
  const userState = useUserState();
  const ride = useMemo(() => {
    return (rideState as { ride: RideNotificationType })?.ride;
  }, [rideState]);
  const driver_is_on_free_trial = useMemo(
    () => userState?.isOnFreeTrial,
    [userState?.isOnFreeTrial],
  );

  return useMutation({
    async mutationFn({
      start_otp,
      waiting_charge,
      toll,
      extra_dx,
    }: {
      start_otp: string;
      waiting_charge: number;
      toll: number;
      extra_dx: number;
    }) {
      const coordinates = (await getLocationAsync()).coords;

      console.log("Fare component for create ride request:", waiting_charge);
      return await makeApiCall({
        url: `create-ride/${driver_is_on_free_trial!}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
        data: {
          start_otp: start_otp,
          a: {
            lat: coordinates.latitude ?? ride.data.from.geo_point.latitude,
            lon: coordinates.longitude ?? ride.data.from.geo_point.longitude,
          },
          b: {
            lat: ride.data.to.geo_point.latitude,
            lon: ride.data.to.geo_point.longitude,
          },
          fare_component: {
            waiting_charge,
            toll,
            extra_dx,
          },
        },
      });
    },
    onError(error, variables, context) {
      console.log(error);
    },
    async onSuccess(data, variables, context) {
      console.log(data);
    },
  });
}

export function useSetDriverArrived() {
  const { makeApiCall } = useApiClient();
  const { rideState } = useRideRequest();
  const ride = useMemo(() => {
    return (rideState as { ride: RideNotificationType })?.ride;
  }, [rideState]);
  return useMutation<any, Error, { arrivedAt: number | string }>({
    async mutationFn({ arrivedAt }) {
      return await makeApiCall({
        url: "driver/arrived-at-pickup-location",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: {
          msg: "I have arrived at pickup location.",
          ride_id: ride.id,
          at_location: (() => {
            const loc = locationStore.get(["location"]);
            return loc
              ? { lat: loc.latitude, lon: loc.longitude }
              : {
                  lat: ride.data.from.geo_point.latitude,
                  lon: ride.data.from.geo_point.longitude,
                };
          })(),
          arrived_at: arrivedAt as number,
        },
        unmountSignal: new AbortController().signal,
      });
    },
    onSuccess() {},
    onError() {},
  });
}
export function useEndrideRequestMutation() {
  const { makeApiCall } = useApiClient();
  const { rideState, removeRide } = useRideRequest();
  const { setRideStatus } = useRideRequestStatus();
  const ride = useMemo(() => {
    return (rideState as { ride: RideNotificationType })?.ride;
  }, [rideState]);
  return useMutation({
    async mutationFn({ last_location }: { last_location: GeoPoint }) {
      return await makeApiCall({
        url: `end-ride/${ride.id}/end`,
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
        data: {
          ride_path_id: ride?.data.search_request_id,
          geo_point: {
            lat: last_location.latitude,
            lon: last_location.longitude,
          },
        },
      });
    },
    async onSuccess(data, variables, context) {
      removeRide();
      setRideStatus({
        type: "UPDATE_RIDE_STATUS",
        payload: {
          ...initialRideStatus.rideStatus,
          arrivedAt: undefined,
          waitingTime: undefined,
        },
      });
      rideStore.removeMany([], ["ride", "rideStatus"]);
    },
    onError(error, variables, context) {},
    retry: 3,
  });
}

export function useConfirmCollectedCash() {
  const { makeApiCall } = useApiClient();
  return useMutation<
    any,
    Error,
    { ride_id: string; is_discounted: boolean; discount: number }
  >({
    async mutationFn({ ride_id, is_discounted, discount }) {
      return await makeApiCall({
        url: `confirm-collected-cash/${ride_id}/${is_discounted}/${discount}`,
        method: "post",
        data: {},
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    onSuccess(data, variables, context) {},
    onError(error, variables, context) {},
    retry: 3,
  });
}

/**
 * Raw fare snapshot returned by `GET /api/rides/{ride_id}/fare`.
 *
 * `components` is an open map: it always contains `estimated_fare`, plus any
 * surcharge keys the backend allows (waiting_charge, toll, fuel_surcharge,
 * pickup_fare, ... — admin-extendable). Decimal fields may arrive as a number
 * or a string depending on the serializer, so coerce with `Number()`.
 */
export type RideFareSnapshot = {
  id: string;
  ride_id: string;
  components: Record<string, number | string>;
  total: number | string;
  status: string;
  reason: string | null;
  recorded_at: string;
};

export type FareBreakdownLine = {
  key: string;
  label: string;
  amount: number;
  isEstimate: boolean;
};

/** Friendly labels for known fare keys. */
const FARE_LABELS: Record<string, string> = {
  estimated_fare: "Ride fare",
  waiting_charge: "Waiting charge",
  toll: "Toll",
  extra_dx: "Extra distance",
  pickup_fare: "Pick-up fare",
  fuel_surcharge: "Fuel surcharge",
};

/** Title-cases an unknown snake_case key so new surcharges still render. */
function humanizeFareKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function labelForFareKey(key: string): string {
  return FARE_LABELS[key] ?? humanizeFareKey(key);
}

/**
 * Fetches the latest fare snapshot for a ride and derives a render-ready
 * breakdown. The estimate is sorted first; surcharges follow. Any new fare
 * type the backend introduces flows through automatically — no client change.
 */
export function useRideFare(ride_id: string) {
  const { fetcher } = useApiClient();
  const query = useQuery<RideFareSnapshot>({
    queryKey: ["ride-fare", ride_id],
    queryFn: () => fetcher(`api/rides/${ride_id}/fare`),
    enabled: !!ride_id,
  });

  const breakdown: FareBreakdownLine[] = useMemo(() => {
    const components = query.data?.components ?? {};
    return Object.entries(components)
      .map(([key, value]) => ({
        key,
        label: labelForFareKey(key),
        amount: Number(value) || 0,
        isEstimate: key === "estimated_fare",
      }))
      .sort((a, b) => Number(b.isEstimate) - Number(a.isEstimate));
  }, [query.data]);

  const total = useMemo(() => {
    if (query.data?.total != null) return Number(query.data.total) || 0;
    return breakdown.reduce((sum, line) => sum + line.amount, 0);
  }, [query.data, breakdown]);

  return { ...query, breakdown, total };
}

export function useCancelRideRequest() {
  const { makeApiCall } = useApiClient();
  const { rideState, removeRide } = useRideRequest();
  const ride = useMemo(() => {
    return (rideState as { ride: RideNotificationType })?.ride;
  }, [rideState]);
  return useMutation<any, Error, { note: string; reason: string }>({
    mutationFn: async (data) => {
      return await makeApiCall({
        url: `api/cancel-ride/${ride.id}?account_type=driver`,
        method: "POST",
        data: {
          ...data,
          ride_path_id: ride.data.search_request_id,
        },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      });
    },
    onSuccess: () => {
      console.log("Ride cancelled successfully");
      removeRide();
    },
    onError: (err) => {
      console.warn(err);
    },
    retry: 3,
  });
}
