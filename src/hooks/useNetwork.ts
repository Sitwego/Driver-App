import { useEffect, useRef } from "react";
import { networkStore, useStorage } from "../lib/store";
import type { NetworkStatus } from "../lib/store";

type UseNetworkProps = {
  /** Called once each time the app transitions from offline → online */
  onReconnect?: () => void;
};

type UseNetwork = {
  /** True when the device has no usable internet connection */
  isOffline: boolean;
  /** ISO timestamp of when the app last lost connectivity, if known */
  lastOfflineAt: string | undefined;
  /** Coarse connection quality: "online" | "offline" | "unknown" */
  networkStatus: NetworkStatus | undefined;
};

/**
 * Reactive hook for network connectivity state backed by MMKV.
 *
 * ```ts
 * const { isOffline, lastOfflineAt } = useNetwork({
 *   onReconnect: () => refetchData(),
 * });
 * ```
 *
 * - `isOffline` is **false** when the status is "unknown".
 * - `onReconnect` is stable across renders; the ref trick means you never
 *   need to add it to a dependency array.
 */
export default function useNetwork({
  onReconnect,
}: UseNetworkProps = {}): UseNetwork {
  // Keep a stable ref so callers don't need to memoize the callback
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  });

  const [isOfflineRaw] = useStorage(networkStore, ["isOffline"]);
  const [networkStatus] = useStorage(networkStore, ["networkStatus"]);
  const [lastOfflineAt] = useStorage(networkStore, ["lastOfflineAt"]);

  // "unknown" status means we have not yet determined connectivity — treat as online
  const isOffline =
    networkStatus === "unknown" ? false : (isOfflineRaw ?? false);

  const prevOfflineRef = useRef(isOffline);
  useEffect(() => {
    const didReconnect = prevOfflineRef.current && !isOffline;
    prevOfflineRef.current = isOffline;

    if (didReconnect) {
      onReconnectRef.current?.();
    }
  }, [isOffline]);

  return { isOffline, lastOfflineAt, networkStatus };
}
