import * as ExpoNotifications from "expo-notifications";
import { Platform } from "react-native";

// Sound file stems (no extension) matching android/app/src/main/res/raw/*.
// expo-notifications strips extensions on Android — always pass the stem.
const SFX = {
  ALLOCATION_REQUEST: "allocation_request", // allocation_request.mp3
  RIDE_START: "ride_start", // ride_start.mp3
  RIDE_CANCELED: "ride_canceled", // ride_canceled.mp3
  DRIVER_ARRIVED: "driver_arrived", // driver_arrived.mp3
  EARNINGS: "notification9", // notification9.mp3
  PROMOTIONS: "notification1", // notification1.wav
  DEFAULT: "notif_default", // notif_default.mp3 (renamed from default.mp3 — reserved Java keyword)
} as const;

export const CHANNEL = {
  // ── Ride lifecycle ────────────────────────────────────────────────────────
  RIDE_REQUESTS: "ride-requests", // new incoming request
  RIDE_STARTED: "ride-started", // RideStartEvent
  RIDE_CANCELED: "ride-canceled", // RideCancelEvent
  DRIVER_ARRIVED: "driver-arrived", // DriverArrivedEvent
  RIDE_UPDATES: "ride-updates", // generic fallback (FareChange, etc.)
  // ── Other ─────────────────────────────────────────────────────────────────
  EARNINGS: "earnings",
  PROMOTIONS: "promotions",
  SYSTEM: "system",
} as const;

export type ChannelId = (typeof CHANNEL)[keyof typeof CHANNEL];

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Promise.all([
    // ── Ride request ──────────────────────────────────────────────────────
    ExpoNotifications.setNotificationChannelAsync(CHANNEL.RIDE_REQUESTS, {
      name: "Ride Requests",
      importance: ExpoNotifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6B35",
      lockscreenVisibility:
        ExpoNotifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      sound: SFX.ALLOCATION_REQUEST,
    }),

    // ── Ride lifecycle events ─────────────────────────────────────────────
    ExpoNotifications.setNotificationChannelAsync(CHANNEL.RIDE_STARTED, {
      name: "Ride Started",
      importance: ExpoNotifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      sound: SFX.RIDE_START,
    }),

    ExpoNotifications.setNotificationChannelAsync(CHANNEL.RIDE_CANCELED, {
      name: "Ride Canceled",
      importance: ExpoNotifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      sound: SFX.RIDE_CANCELED,
    }),

    ExpoNotifications.setNotificationChannelAsync(CHANNEL.DRIVER_ARRIVED, {
      name: "Driver Arrived",
      importance: ExpoNotifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
      sound: SFX.DRIVER_ARRIVED,
    }),

    ExpoNotifications.setNotificationChannelAsync(CHANNEL.RIDE_UPDATES, {
      name: "Ride Updates",
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
      sound: SFX.DEFAULT,
    }),

    // ── Other ─────────────────────────────────────────────────────────────
    ExpoNotifications.setNotificationChannelAsync(CHANNEL.EARNINGS, {
      name: "Earnings & Payments",
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
      sound: SFX.EARNINGS,
    }),

    ExpoNotifications.setNotificationChannelAsync(CHANNEL.PROMOTIONS, {
      name: "Promotions",
      importance: ExpoNotifications.AndroidImportance.LOW,
      sound: SFX.PROMOTIONS,
    }),

    ExpoNotifications.setNotificationChannelAsync(CHANNEL.SYSTEM, {
      name: "System",
      importance: ExpoNotifications.AndroidImportance.DEFAULT,
      sound: SFX.DEFAULT,
    }),
  ]);
}
