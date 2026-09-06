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

// ─── Wallet & payouts ─────────────────────────────────────────────────────────

/**
 * The driver's wallet — where money Sitwego owes them accumulates.
 *
 * Two things land here: referral rewards, and the platform's share of every
 * discounted ride they drove (`reference: "promotion_credit"`). It used to be
 * neither — a promotion credit was netted off the subscription bill, which is
 * not the same as being paid.
 */
export type WalletResponse = {
  balance: number | string;
  currency: string;
};

export type WalletTransaction = {
  id: string;
  /** Signed: positive is money in, negative is a withdrawal. */
  amount: number | string;
  balance_after: number | string;
  /** e.g. `promotion_credit`, `referral_reward`, `payout`, `payout_reversal`. */
  reference: string;
  reference_id: string | null;
  created_at: string;
};

export type PayoutState =
  | "requested"
  | "acked"
  | "paid"
  | "failed"
  | "timed_out";

export type DriverPayout = {
  id: string;
  amount: number | string;
  msisdn: string;
  state: PayoutState;
  mpesa_receipt_number: string | null;
  result_desc: string | null;
  requested_at: string;
  completed_at: string | null;
};

export function useDriverWallet() {
  const { fetcher } = useApiClient();
  return useQuery<WalletResponse>({
    queryKey: ["driver-wallet"],
    queryFn: () => fetcher("driver/wallet"),
  });
}

export function useWalletTransactions(limit = 20) {
  const { fetcher } = useApiClient();
  return useQuery<WalletTransaction[]>({
    queryKey: ["driver-wallet-transactions", limit],
    queryFn: () => fetcher(`driver/wallet/transactions?limit=${limit}`),
  });
}

export function usePayoutHistory(limit = 20) {
  const { fetcher } = useApiClient();
  return useQuery<DriverPayout[]>({
    queryKey: ["driver-payouts", limit],
    queryFn: () => fetcher(`driver/wallet/payouts?limit=${limit}`),
  });
}

/**
 * How far a ride's discount has got on its way to the driver.
 *
 * `in_transit` is deliberately not `paid_out`: a withdrawal that has been
 * requested has left the wallet but can still fail and come back, so telling a
 * driver they have been paid for it would be a promise the server has not made.
 *
 * `settled_off_bill` only appears on old rides, from the superseded model where
 * a discount was netted off the subscription bill instead of paid out.
 */
export type CreditStatus =
  | "awaiting_payout"
  | "in_transit"
  | "paid_out"
  | "settled_off_bill";

/** A completed ride whose customer paid a discounted fare. */
export type DiscountedRide = {
  ride_id: string;
  /** The full, pre-discount fare — what the driver EARNED (invariant D1). */
  fare: number | string;
  /** The platform's share: what Sitwego owes back for this ride. */
  discount: number | string;
  currency: string;
  /** ISO timestamp. */
  created_at: string;
  /** Kilometres. */
  estimated_distance: number | null;
  /** Seconds. */
  estimated_duration: number | null;
  to_ward: string | null;
  to_city: string | null;
  status: CreditStatus;
};

/**
 * Counts across the driver's whole history, not just the page — a figure
 * derived from `rides.length` would shrink as they scrolled.
 */
export type DiscountedRidesSummary = {
  total_rides: number;
  /** Rides whose share is still in the wallet: the "not yet compensated" count. */
  awaiting_payout: number;
  in_transit: number;
  paid_out: number;
  /** Sum of everything not yet in the driver's hands. */
  total_discount: number | string;
  currency: string;
};

export type DiscountedRidesResponse = {
  summary: DiscountedRidesSummary;
  rides: DiscountedRide[];
};

/**
 * The discounted rides behind the wallet balance.
 *
 * Note this returns rides that have ALREADY been paid out, marked as such. A
 * driver who withdraws should not watch the record of what the money was for
 * disappear along with it.
 */
export function useDiscountedRides(limit = 50) {
  const { fetcher } = useApiClient();
  return useQuery<DiscountedRidesResponse>({
    queryKey: ["driver-discounted-rides", limit],
    queryFn: () => fetcher(`driver/wallet/discounted-rides?limit=${limit}`),
  });
}

export type WithdrawResponse = {
  payout_id: string;
  amount: number | string;
  /** Masked, e.g. `*********678`. */
  msisdn: string;
  state: string;
  message: string;
};

/**
 * Withdraw wallet money to M-Pesa.
 *
 * Note the body carries **only an amount**. The destination is the driver's own
 * verified profile number, read server-side — a client-supplied payout number
 * would let anyone who got hold of a token redirect the money. Any UI offering
 * to edit it would be lying about what the server does.
 *
 * Retries are deliberately off. This request moves real money, and a retry of a
 * request that actually succeeded but whose response was lost would be refused
 * server-side (one payout in flight at a time) but still shows the driver an
 * error for a withdrawal that worked.
 */
export function useWithdrawFromWallet() {
  const { makeApiCall } = useApiClient();
  return useMutation<WithdrawResponse, Error, { amount: number }>({
    mutationFn: async ({ amount }) =>
      await makeApiCall<WithdrawResponse>({
        url: "driver/wallet/withdraw",
        method: "POST",
        data: { amount },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        unmountSignal: new AbortController().signal,
      }),
    retry: false,
  });
}
