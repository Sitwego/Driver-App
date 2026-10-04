import type { RouteProp } from "@react-navigation/native";
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

export type NavigationProps<T extends keyof RootStackNavigationType> =
  NativeStackScreenProps<RootStackNavigationType, T, undefined>;

// ---------------------------------------------------------------------------
// Subscription domain types  (used in route params and screen components)
// ---------------------------------------------------------------------------

export type SubscriptionCategory = "Taxi" | "TukTuk" | "Bike";

/** Snapshot of the driver's current active subscription from the server. */
export type ActiveSubscription = {
  plan_id: string;
  /** Number of rides already taken today. */
  rides_used: number;
  /** Human-readable next billing date, e.g. "Mar 4, 2026". */
  next_billing_date: string;
} | null;

// ---------------------------------------------------------------------------
// Vehicle domain types  (used in route params and screen components)
// ---------------------------------------------------------------------------

/**
 * A driver's vehicle, as returned by `api/get-driver-vehicle-categories`.
 *
 * Only the required fields below are confirmed to come back today — they are
 * the ones the vehicle list has always read. The rest are captured during
 * onboarding (see `ControlsContextType["vehicleDetails"]`) but have not been
 * verified on this response, so they stay optional and every consumer has to
 * handle them being absent. Promote one to required once the endpoint is known
 * to send it.
 */
export type DriverVehicle = {
  make: string;
  model: string;
  plate_number: string;
  y_manufacturing: number;
  categories: string[];

  // ── Unconfirmed on this endpoint — render only when present ────────────
  vehicle_type?: string;
  color?: string;
  capacity?: number;
  vin?: string;
  /** Absent is treated as "in use"; only an explicit false demotes the badge. */
  in_use?: boolean;
};

// ---------------------------------------------------------------------------
// Shared stack param list
// Contains all screens registered in sharedStackScreens()
// ---------------------------------------------------------------------------
export type RootStackNavigationType = {
  RideScreen: undefined;
  EditPersonalDetails: undefined;
  NavigationAndSoundsScreen: undefined;
  RadiusSettingsScreen: undefined;
  SecurityCenterScreen: undefined;
  HelpScreen: undefined;
  AboutScreen: undefined;
  CollectCashAndConfirmRideEnded: { fare: number; ride_id: string };
  RatingScreen: RatingScreenParams;
  RatingOverview: { driverId: string };
  AllReviews: { driverId: string };
  VehicleAndCategoriesScreen: { data: DriverVehicle };
  VehicleDetails: { vehicle: DriverVehicle };
  PaymentScreen: undefined;
  PayOut: undefined;
  MyDocuments: undefined;

  // ── Subscription screens ─────────────────────────────────────────────────
  SubscriptionOverview: {
    category: SubscriptionCategory;
    activeSub?: ActiveSubscription;
  };
  SubscriptionPlanDetails: {
    planId: string;
    category: SubscriptionCategory;
    /** Pass the driver's active sub so the screen can show the "Current Plan"
     *  badge and enable the active-management flow. */
    activeSub?: ActiveSubscription;
  };
  SubscriptionActiveManagement: {
    planId: string;
    category: SubscriptionCategory;
    /** Non-nullable — this screen requires an active subscription to render. */
    activeSub: NonNullable<ActiveSubscription>;
  };
  Payment: PaymentScreenParams;
};

// ---------------------------------------------------------------------------
// Payment screen route params
// ---------------------------------------------------------------------------

export type PaymentScreenParams = {
  /** Amount due in cents. */
  amountDue: number;
  /**Plan Id */
  planId?: string;
};

// ---------------------------------------------------------------------------
// RatingScreen route params
// ---------------------------------------------------------------------------
export type RatingScreenParams = {
  /** Unique identifier of the completed ride */
  rideId: string;
  /**An optional rider's name */
  riderName?: string;
};

export type VehicleAndCategoriesScreenNavigationProp =
  NativeStackNavigationProp<
    RootStackNavigationType,
    "VehicleAndCategoriesScreen"
  >;

export type VehicleAndCategoriesScreenProps =
  NavigationProps<"VehicleAndCategoriesScreen">;

export type VehicleDetailsScreenProps = NavigationProps<"VehicleDetails">;

// ---------------------------------------------------------------------------
// Convenience screen-prop types for RatingScreen
// ---------------------------------------------------------------------------
export type RatingScreenNavigationProp = NativeStackNavigationProp<
  RootStackNavigationType,
  "RatingScreen"
>;

export type RatingScreenRouteProp = RouteProp<
  RootStackNavigationType,
  "RatingScreen"
>;

export type RatingScreenProps = NativeStackScreenProps<
  RootStackNavigationType,
  "RatingScreen"
>;

// ---------------------------------------------------------------------------
// Convenience screen-prop types for Subscription screens
// ---------------------------------------------------------------------------
export type SubscriptionOverviewScreenProps =
  NavigationProps<"SubscriptionOverview">;

export type SubscriptionPlanDetailsScreenProps =
  NavigationProps<"SubscriptionPlanDetails">;

export type SubscriptionActiveManagementScreenProps =
  NavigationProps<"SubscriptionActiveManagement">;

// ---------------------------------------------------------------------------
// Convenience screen-prop types for Payment screen
// ---------------------------------------------------------------------------
export type PaymentScreenProps = NavigationProps<"Payment">;

// ---------------------------------------------------------------------------
// Convenience screen-prop types for the discount payout screen
// ---------------------------------------------------------------------------
export type PayOutScreenProps = NavigationProps<"PayOut">;
