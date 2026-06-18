import NetInfo from "@react-native-community/netinfo";
import { differenceInHours } from "date-fns/differenceInHours";
import throttle from "lodash/throttle";

import { networkStore } from "../store";

import type { NetworkStatus } from "../store";

// ─── Constants ────────────────────────────────────────────────────────────────

const REACHABILITY_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_BASE_URL_DEV ??
    "https://nymphaeaceous-viscometrically-freeda.ngrok-free.dev")
  : (process.env.EXPO_PUBLIC_API_BASE_URL ?? "");

const REACHABILITY_TIMEOUT = 10 * 1_000;
/** How often to re-probe while the device is offline */
const RECHECK_INTERVAL_MS = 60 * 1_000;
/** Minimum gap between consecutive NetInfo.refresh() calls */
const MIN_RECHECK_INTERVAL_MS = 10 * 1_000;

type ResponseJSON = { jsonCode: number };

// ─── In-memory state (hydrated from MMKV on module load) ─────────────────────

/**
 * Mirrors networkStore so hot-path reads stay synchronous
 * without hitting storage on every check.
 */
let isOffline = networkStore.get(["isOffline"]) ?? false;
let isServerUp = networkStore.get(["isServerUp"]) ?? true;
let wasServerDown = false;
let shouldForceOffline = networkStore.get(["shouldForceOffline"]) ?? false;
let connectionChanges = networkStore.get(["connectionChanges"]);

/** True once the first NetInfo event has been processed */
let isNetworkStatusInitialized = false;

// ─── Reconnection callbacks ───────────────────────────────────────────────────

let callbackID = 0;
const reconnectionCallbacks: Record<string, () => void> = {};

// ─── Recheck guard ────────────────────────────────────────────────────────────

/** Exported so unit tests can inspect / control internal state */
const recheckNetworkState = {
  isCheckPending: false,
  lastCheckTimestamp: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function persistConnectionChanges(
  changes: Partial<{ startTime: number; amount: number }>,
) {
  const current = connectionChanges ?? { startTime: Date.now(), amount: 0 };
  connectionChanges = { ...current, ...changes };
  networkStore.set(["connectionChanges"], connectionChanges);
}

/**
 * Tracks how many times the connection toggled within a rolling hour.
 * Logs a warning if instability is detected.
 */
function trackConnectionChanges() {
  if (!connectionChanges?.startTime) {
    persistConnectionChanges({ startTime: Date.now(), amount: 1 });
    return;
  }

  const diffInHours = differenceInHours(
    new Date(),
    connectionChanges.startTime,
  );
  const newAmount = (connectionChanges.amount ?? 0) + 1;

  if (diffInHours < 1) {
    persistConnectionChanges({ amount: newAmount });
    return;
  }

  console.log(
    `[NetworkConnection] Connection changed ${newAmount} time(s) in the last ${diffInHours} hour(s).`,
  );
  persistConnectionChanges({ startTime: Date.now(), amount: 0 });
}

/**
 * Throttled — fires reconnection callbacks at most once every 5 s.
 * If the server just came back up, adds a random delay (up to 60 s) to
 * avoid thundering-herd against the backend.
 */
const triggerReconnectionCallbacks = throttle(
  (reason: string) => {
    let delay = 0;
    if (wasServerDown && isServerUp) {
      delay = Math.floor(Math.random() * 61_000);
      wasServerDown = false;
    }
    setTimeout(() => {
      console.log(
        `[NetworkConnection] Firing reconnection callbacks because: ${reason}`,
      );
      for (const cb of Object.values(reconnectionCallbacks)) {
        cb();
      }
    }, delay);
  },
  5_000,
  { trailing: false },
);

/**
 * Calls NetInfo.refresh() at most once per MIN_RECHECK_INTERVAL_MS.
 * Safe to call frequently — duplicate calls are silently dropped.
 */
function recheckNetworkConnection() {
  const now = Date.now();

  if (recheckNetworkState.isCheckPending) {
    console.log("[NetworkConnection] Refresh already in progress, skipping.");
    return;
  }

  if (now - recheckNetworkState.lastCheckTimestamp < MIN_RECHECK_INTERVAL_MS) {
    console.log("[NetworkConnection] Refresh called too soon, skipping.");
    return;
  }

  recheckNetworkState.isCheckPending = true;
  recheckNetworkState.lastCheckTimestamp = now;
  console.log("[NetworkConnection] Refreshing NetInfo.");

  NetInfo.refresh()
    .catch((err: unknown) => {
      console.log("[NetworkConnection] NetInfo.refresh failed.", String(err));
    })
    .finally(() => {
      recheckNetworkState.isCheckPending = false;
    });
}

// ─── Core status setter ───────────────────────────────────────────────────────

/**
 * Single point of truth for changing the offline status.
 * Persists to MMKV, tracks connection changes, and fires
 * reconnection callbacks when transitioning offline → online.
 */
function setOfflineStatus(isCurrentlyOffline: boolean, reason = ""): void {
  trackConnectionChanges();

  if (isCurrentlyOffline && !isOffline) {
    // Just went offline — record the timestamp
    networkStore.set(["lastOfflineAt"], new Date().toISOString());
  }

  if (isOffline && !isCurrentlyOffline) {
    // Reconnected — fire queued callbacks
    triggerReconnectionCallbacks("offline status changed");
  }

  isOffline = isCurrentlyOffline;
  networkStore.set(["isOffline"], isCurrentlyOffline);
  console.log(
    `[NetworkConnection] setOfflineStatus → ${isCurrentlyOffline}${reason ? ` (${reason})` : ""}`,
  );
}

function setNetworkStatus(status: NetworkStatus) {
  networkStore.set(["networkStatus"], status);
}

// ─── shouldForceOffline — react to MMKV changes from outside ─────────────────
//
// External code (e.g. a debug screen) can call:
//   networkStore.set(["shouldForceOffline"], true)
// and the listener below will respond automatically.

networkStore.addOnValueChangedListener(["shouldForceOffline"], () => {
  const next = networkStore.get(["shouldForceOffline"]) ?? false;
  if (next === shouldForceOffline) return;
  shouldForceOffline = next;

  if (shouldForceOffline) {
    setOfflineStatus(true, "shouldForceOffline toggled in storage");
  } else {
    // Re-probe real network state now that force-offline is lifted
    NetInfo.fetch().then((state) => {
      const offline = (state.isInternetReachable ?? false) === false;
      setOfflineStatus(
        offline || !isServerUp,
        "NetInfo probed after force-offline lifted",
      );
    });
  }
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Configures NetInfo and subscribes to connection changes.
 *
 * @returns Unsubscribe function — call it to clean up listeners and timers
 */
function subscribeToNetInfo(sessionId?: string): () => void {
  NetInfo.configure({
    reachabilityMethod: "GET",
    reachabilityUrl: REACHABILITY_URL,
    reachabilityRequestTimeout: REACHABILITY_TIMEOUT,
    reachabilityTest: async (response) => {
      if (!response.ok) {
        console.log(
          `[NetworkConnection] Reachability test failed with status ${response.status} — treating as offline.`,
        );
        return false;
      }
      try {
        const json: ResponseJSON = await response.json();
        if (json.jsonCode !== 200 && isServerUp) {
          console.log(
            "[NetworkConnection] Non-200 from reachability — server down.",
          );
          isServerUp = false;
          wasServerDown = true;
          networkStore.set(["isServerUp"], false);
        } else if (json.jsonCode === 200 && !isServerUp) {
          console.log(
            "[NetworkConnection] 200 from reachability — server back up.",
          );
          isServerUp = true;
          networkStore.set(["isServerUp"], true);
        }
        return json.jsonCode === 200;
      } catch {
        isServerUp = false;
        wasServerDown = true;
        networkStore.set(["isServerUp"], false);
        return false;
      }
    },
  });

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (!isNetworkStatusInitialized) {
      isNetworkStatusInitialized = true;
    }

    console.log("[NetworkConnection] NetInfo state change", { ...state });

    if (shouldForceOffline) {
      console.log(
        "[NetworkConnection] Skipping — shouldForceOffline is active.",
      );
      return;
    }

    const offline = state.isInternetReachable === false || !isServerUp;
    setOfflineStatus(offline, "NetInfo state change event");

    const status: NetworkStatus =
      state.isInternetReachable === null ||
      state.isInternetReachable === undefined
        ? "unknown"
        : state.isInternetReachable
          ? "online"
          : "offline";

    setNetworkStatus(status);
  });

  // While offline, periodically re-probe so we detect reconnection quickly
  const recheckIntervalID = setInterval(() => {
    if (!isOffline) return;
    recheckNetworkConnection();
    console.log("[NetworkConnection] Periodic recheck (currently offline).");
  }, RECHECK_INTERVAL_MS);

  return () => {
    clearInterval(recheckIntervalID);
    unsubscribeNetInfo();
  };
}

/**
 * Register a callback to run when the app reconnects to the internet.
 * @returns Unsubscribe function
 */
function onReconnect(callback: () => void): () => void {
  const id = callbackID++;
  reconnectionCallbacks[id] = callback;
  return () => delete reconnectionCallbacks[id];
}

function clearReconnectionCallbacks() {
  for (const key of Object.keys(reconnectionCallbacks)) {
    delete reconnectionCallbacks[key];
  }
}

export default {
  subscribeToNetInfo,
  setOfflineStatus,
  onReconnect,
  clearReconnectionCallbacks,
  triggerReconnectionCallbacks,
  recheckNetworkConnection,
  recheckNetworkState,
};

export type { NetworkStatus };
