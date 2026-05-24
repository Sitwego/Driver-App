import { navigate } from "~/navigation/navigation";
import { CHANNEL, type ChannelId } from "./channels";

export type NotificationCategory =
  | "ride_request"
  | "ride_update"
  | "earnings"
  | "promotion"
  | "subscription"
  | "system";

// FCM data payload values are always strings
export type PushNotificationData = {
  category: NotificationCategory;
  /** e.g. "RideStartEvent", "RideCancelEvent" — narrows ride_update category */
  type?: string;
  ride_id?: string;
  vehicle_category?: string; // "Taxi" | "TukTuk" | "Bike"
  plan_id?: string;
  [key: string]: string | undefined;
};

export function channelForCategory(
  category: NotificationCategory,
  type?: string,
): ChannelId {
  switch (category) {
    case "ride_request":
      return CHANNEL.RIDE_REQUESTS;
    case "ride_update":
      switch (type) {
        case "RideStartEvent":
          return CHANNEL.RIDE_STARTED;
        case "RideCancelEvent":
          return CHANNEL.RIDE_CANCELED;
        case "DriverArrivedEvent":
          return CHANNEL.DRIVER_ARRIVED;
        default:
          return CHANNEL.RIDE_UPDATES;
      }
    case "earnings":
      return CHANNEL.EARNINGS;
    case "promotion":
      return CHANNEL.PROMOTIONS;
    case "subscription":
      return CHANNEL.SYSTEM;
    case "system":
    default:
      return CHANNEL.SYSTEM;
  }
}

const VALID_VEHICLE_CATEGORIES = ["Taxi", "TukTuk", "Bike"] as const;

export function routeNotificationTap(
  data: PushNotificationData | undefined,
): void {
  if (!data?.category) return;

  switch (data.category) {
    case "ride_request":
      navigate("Map");
      break;

    case "ride_update":
      navigate("RideScreen");
      break;

    case "earnings":
      // "HandCoins" is the tab screen name registered in the bottom tab navigator
      navigate("HandCoins");
      break;

    case "subscription": {
      const vehicleCategory = VALID_VEHICLE_CATEGORIES.includes(
        data.vehicle_category as any,
      )
        ? (data.vehicle_category as "Taxi" | "TukTuk" | "Bike")
        : "Taxi";
      navigate("SubscriptionOverview", { category: vehicleCategory });
      break;
    }

    case "promotion":
    case "system":
    default:
      navigate("Map");
      break;
  }
}
