import messaging, {
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import * as ExpoNotifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";

import { setupNotificationChannels } from "~/lib/notifications/channels";
import {
  channelForCategory,
  type PushNotificationData,
  routeNotificationTap,
} from "~/lib/notifications/notificationRouter";

// Must be set at module load — before any notification arrives.
// Controls how notifications are presented when the app is in the foreground.
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function presentForegroundNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const { notification, data, messageId } = remoteMessage;
  if (!notification) return; // data-only message — no UI to show

  const payload = data as PushNotificationData | undefined;
  const channelId = payload?.category
    ? channelForCategory(payload.category, payload.type)
    : "system";

  await ExpoNotifications.scheduleNotificationAsync({
    identifier: messageId,
    content: {
      title: notification.title ?? "",
      body: notification.body ?? "",
      data: payload ?? {},
      sound: "default",
    },
    // DATE trigger with channelId assigns the Android notification channel.
    // +100 ms keeps it effectively immediate while satisfying the scheduler.
    // On iOS, trigger: null fires immediately (channels are Android-only).
    trigger:
      Platform.OS === "android"
        ? {
            type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(Date.now() + 100),
            channelId,
          }
        : null,
  });
}

/**
 * Wire up all FCM + expo-notifications listeners for the lifetime of the
 * component that calls this hook (should be mounted once, e.g. InnerApp).
 *
 * Tap handling — three paths, one router (routeNotificationTap):
 *  1. Foreground tap   → FCM message is bridged to a local expo notification;
 *                        useLastNotificationResponse picks up the tap reactively.
 *  2. Background tap   → user taps an OS system-tray notification while the app
 *                        is backgrounded; Firebase onNotificationOpenedApp fires.
 *  3. Killed-state tap → user taps and the app cold-starts; Firebase
 *                        getInitialNotification resolves once on mount.
 *
 * Paths 2 and 3 cannot go through expo-notifications because Firebase delivers
 * background/killed notifications directly to the OS, bypassing the expo layer.
 */
export function useNotificationHandler(): void {
  // Path 1 — foreground tap (locally-scheduled expo notification).
  // Reactive hook: re-runs whenever the user taps a new local notification,
  // matching the pattern used in the customer app.
  const lastResponse = ExpoNotifications.useLastNotificationResponse();
  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | PushNotificationData
      | undefined;
    routeNotificationTap(data);
  }, [lastResponse]);

  // Path 3 — killed-state tap. Resolves once; no cleanup needed.
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then((msg) => {
        if (!msg) return;
        // Delay until NavigationContainer has mounted and is ready.
        setTimeout(
          () => routeNotificationTap(msg.data as PushNotificationData),
          500,
        );
      });
  }, []);

  useEffect(() => {
    // Create Android channels once on mount (safe to call repeatedly — no-ops
    // if the channel already exists with the same config).
    setupNotificationChannels();

    // Foreground FCM: Android won't auto-show a notification while the app is
    // open, so bridge it through expo-notifications as a local notification.
    const unsubForeground = messaging().onMessage(async (msg) => {
      if (Platform.OS === "android") {
        await presentForegroundNotification(msg);
      }
    });

    // Path 2 — background tap.
    const unsubBackgroundTap = messaging().onNotificationOpenedApp((msg) => {
      routeNotificationTap(msg.data as PushNotificationData);
    });

    return () => {
      unsubForeground();
      unsubBackgroundTap();
    };
  }, []);
}
