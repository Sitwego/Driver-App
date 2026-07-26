import { useCallback } from "react";

import { isDriverOnline } from "~/lib/native";

export function useIsdriverOnline() {
  // Stable identity: consumers use this in effect deps, so a fresh closure
  // per render would re-run their effects on every render.
  return useCallback(async () => {
    const isOnline = await isDriverOnline();
    if (typeof isOnline === "undefined") {
      return false;
    } else {
      return isOnline;
    }
  }, []);
}
