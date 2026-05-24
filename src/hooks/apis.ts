import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useApiClient } from "./useApiClient";
import { TravelPreferences, vehicleCategoryStore } from "~/lib/store";
import { useUserState } from "~/lib/state/userState";
import type {
  RatingSummaryData,
  DriverReview,
} from "~/components/RatingSummary";

export function useGetDriverVehicleCategories() {
  const { fetcher } = useApiClient();

  const query = useQuery({
    queryKey: ["driver-vehicle-categories"],
    queryFn: () => fetcher("api/get-driver-vehicle-categories"),
    enabled: false,
  });

  const { refetch } = query;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return query;
}

type SubmitRiderReviewVars = {
  rideId: string;
  punctuality: number;
  respectfulness: number;
  fareReadiness: number;
  comment?: string;
};
export function useUpdateTravelPreferences() {
  const { makeApiCall } = useApiClient();
  const { profile_id } = useUserState();

  return useMutation<any, Error, TravelPreferences>({
    mutationFn(preferences) {
      return makeApiCall({
        method: "PUT",
        url: `api/driver/${profile_id}/preferences`,
        headers: { "Content-Type": "application/json" },
        data: preferences,
      });
    },
    onError(error) {
      console.error("Failed to update travel preferences❌❌", error);
    },
    onSuccess(data) {
      console.log("Travel preferences updated successfully✅✅", data);
    },
  });
}

export function useUpdateBio() {
  const { makeApiCall } = useApiClient();

  return useMutation<any, Error, { bio: string }>({
    mutationFn({ bio }) {
      return makeApiCall({
        method: "PUT",
        url: `api/profile/bio`,
        headers: { "Content-Type": "application/json" },
        data: { bio },
      });
    },
    onError(error) {
      console.error("Failed to update bio❌❌", error);
    },
    onSuccess(data) {
      console.log("Bio updated successfully✅✅", data);
    },
  });
}

type PersonalDetailsVars = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  date_of_birth: Date;
};
export function useUpdatePersonalDetails() {
  const { makeApiCall } = useApiClient();

  return useMutation<any, Error, PersonalDetailsVars>({
    mutationFn(data) {
      return makeApiCall({
        method: "PUT",
        url: `api/profile/personal-details`,
        headers: { "Content-Type": "application/json" },
        data: {
          first_name: data.first_name,
          middle_name: data.middle_name,
          last_name: data.last_name,
          date_of_birth: data.date_of_birth,
        },
      });
    },
    onError(error) {
      console.error("Failed to update personal details❌❌", error);
    },
    onSuccess(data) {
      console.log("Personal details updated successfully✅✅", data);
    },
  });
}

export type WeeklyChartDataPoint = {
  value: number;
  label: string;
};

export type WeeklyEarningsResponse = {
  total_rides: number;
  total_earnings: number;
  chart_data: WeeklyChartDataPoint[];
};

export function useDriverWeeklyEarnings(weekStart: Date | null) {
  const { fetcher } = useApiClient();

  return useQuery<WeeklyEarningsResponse>({
    queryKey: [
      "driver-weekly-earnings",
      weekStart?.toISOString().split("T")[0],
    ],
    queryFn: () =>
      fetcher(
        `api/get-driver-weekly-earnings-report/${format(weekStart!, "yyyy-MM-dd")}`,
      ),
    enabled: weekStart !== null,
  });
}

export type DailyEarningsRide = {
  ride_id: string;
  amount: number;
  currency: string;
  created_at: string;
  estimated_distance: number;
  estimated_duration: number;
  from_area_code: string | null;
  from_ward: string;
  from_city: string;
  to_area_code: string | null;
  to_ward: string;
  to_city: string;
  has_rated_customer: boolean;
};

export type DailyEarningsSummary = {
  total_earnings: number;
  total_discount: number;
  total_rides: number;
};

export type DailyEarningsResponse = {
  summary: DailyEarningsSummary;
  rides: DailyEarningsRide[];
};

export function useDriverDailyEarnings(selectedDate: Date | null) {
  const { fetcher } = useApiClient();
  return useQuery<DailyEarningsResponse>({
    queryKey: [
      "driver-daily-earnings",
      selectedDate?.toISOString().split("T")[0],
    ],
    queryFn: () =>
      fetcher(
        `api/get-driver-daily-earnings/${format(selectedDate!, "yyyy-MM-dd")}`,
      ),
    enabled: selectedDate !== null,
  });
}

export type { RatingSummaryData, DriverReview };

export function useDriverRatingOverview(driverId: string) {
  const { fetcher } = useApiClient();
  console.log("Fetching rating overview for driverId:", driverId);

  return useQuery<RatingSummaryData>({
    queryKey: ["driver-rating-overview", driverId],
    queryFn: () => fetcher(`api/v1/driver/${driverId}/rating-summary`),
    enabled: !!driverId,
  });
}

type DriverStats = {
  score: number;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export function useGoOnline() {
  const { makeApiCall } = useApiClient();

  return useMutation<any, Error, DriverStats>({
    mutationFn(stats) {
      const categories = vehicleCategoryStore.get(["categories"]) ?? [];
      const vc = categories.find((c) => c != null && c.length > 0) ?? "Swift";
      return makeApiCall({
        method: "POST",
        url: "go-online",
        headers: {
          "Content-Type": "application/json",
          vc,
        },
        data: stats,
      });
    },
    onError(error) {
      console.error("Failed to go online❌❌", error);
    },
    onSuccess(data) {
      console.log("Driver went online successfully✅✅", data);
    },
  });
}

export function useGoOffline() {
  const { makeApiCall } = useApiClient();

  return useMutation<any, Error, void>({
    mutationFn() {
      return makeApiCall({
        method: "POST",
        url: "go-offline",
      });
    },
    onError(error) {
      console.error("Failed to go offline❌❌", error);
    },
    onSuccess(data) {
      console.log("Driver went offline successfully✅✅", data);
    },
  });
}

export function useRateRider() {
  const { makeApiCall } = useApiClient();

  return useMutation<any, Error, SubmitRiderReviewVars>({
    async mutationFn({ rideId, ...ratings }) {
      return makeApiCall({
        method: "POST",
        url: `rate-rider/${rideId}`,
        headers: { "Content-Type": "application/json" },
        data: {
          punctuality: ratings.punctuality,
          respectfulness: ratings.respectfulness,
          fare_readiness: ratings.fareReadiness,
          feedback_details: ratings.comment,
          attachment_id: "",
        },
      });
    },
    onError(error) {},
    onSuccess(data) {
      console.log("Rider review submitted successfully✅✅", data);
    },
  });
}
