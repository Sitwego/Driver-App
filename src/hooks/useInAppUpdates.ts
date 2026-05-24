import { checkForUpdate, startUpdate } from "expo-in-app-updates";
import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

export function useInAppUpdates() {
  const [updateCancelled, setUpdateCancelled] = useState(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS !== "android") return;

    async function check() {
      try {
        const result = await checkForUpdate();
        if (!result.updateAvailable) return;
        try {
          // immediate=true forces the Android immediate-update flow;
          // returns false when the user dismisses the prompt
          const started = await startUpdate(true);
          if (!started) setUpdateCancelled(true);
        } catch {
          setUpdateCancelled(true);
        }
      } catch {
        // network/store error — don't block the user
      }
    }

    check();
  }, []);

  // Prevent hardware back from dismissing the mandatory-update screen
  useEffect(() => {
    if (!updateCancelled) return;
    const handler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => handler.remove();
  }, [updateCancelled]);

  async function retryUpdate() {
    try {
      await startUpdate(true);
      setUpdateCancelled(false);
    } catch {
      // keep the blocker visible
    }
  }

  return { updateCancelled, retryUpdate };
}
