import * as ExpoNotifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";

import { setupNotificationChannels } from "~/lib/notifications/channels";

import { useUpdatePushToken } from "./useUserApi";

export function useRequestPushNotifPermisions() {
  const { mutate: updatePushToken } = useUpdatePushToken();
  // Guards against the token-refresh listener double-calling updatePushToken
  // while an explicit registration is already in flight.
  const isRegistering = useRef(false);

  useEffect(() => {
    const subscription = ExpoNotifications.addPushTokenListener(
      ({ data: token }) => {
        if (!isRegistering.current) {
          updatePushToken({ device_type: "android", device_token: token });
        }
      },
    );
    return () => subscription.remove();
  }, [updatePushToken]);

  return useCallback(async () => {
    if (isRegistering.current) return;

    const perms = await ExpoNotifications.getPermissionsAsync();

    if (perms.status === "denied" && !perms.canAskAgain) return;

    if (perms.status !== "granted") {
      const { granted } = await ExpoNotifications.requestPermissionsAsync();
      if (!granted) return;
    }

    // Permissions are confirmed granted — set up Android channels now so they
    // exist before the first notification can arrive.
    await setupNotificationChannels();

    isRegistering.current = true;
    try {
      const { data: token } = await ExpoNotifications.getDevicePushTokenAsync();
      if (token) {
        updatePushToken({ device_type: "android", device_token: token });
      }
    } catch (error) {
      console.error("Error getting device push token:", error);
    } finally {
      isRegistering.current = false;
    }
  }, [updatePushToken]);
}

export function useGetPushToken() {
  const requestPushToken = useRequestPushNotifPermisions();
  useEffect(() => {
    requestPushToken();
  }, [requestPushToken]);
}
