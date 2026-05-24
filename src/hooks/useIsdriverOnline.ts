import { isDriverOnline } from "~/lib/native";

export function useIsdriverOnline() {
  return async () => {
    const isOnline = await isDriverOnline();
    if (typeof isOnline === "undefined") {
      return false;
    } else {
      return isOnline;
    }
  };
}
