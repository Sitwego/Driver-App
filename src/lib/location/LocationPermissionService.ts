// ------------------------------------------------------------------
// LocationPermissionService
// ------------------------------------------------------------------
//
// Centralised, framework-agnostic gateway for every location-permission
// concern in the app: reading current status, requesting foreground /
// background access, detecting whether GPS is on, and routing the user to
// the correct settings screen.
//
// Design goals:
//   • Single source of truth — every screen/hook calls the same methods, so
//     behaviour is identical everywhere and easy to reason about.
//   • Expected outcomes are RETURNED (LocationPermissionResult), never thrown.
//     Only genuinely exceptional failures throw (LocationPermissionError).
//   • Production sequencing — background is only ever requested *after*
//     foreground is granted, matching both Android 10+ and iOS requirements.
//   • No permission loops — the service never auto-retries; it reports state
//     and lets the UI decide. Persistent flags guard one-shot disclosures.
//
// The custom native GeoKalman foreground service does the actual tracking;
// this module only governs the OS permissions that tracking depends on.

import * as IntentLauncher from "expo-intent-launcher";
import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

import { Storage } from "~/lib/store";

import { LocationPermissionError } from "./errors";

import type {
  IosScope,
  LocationPermissionResult,
  LocationPermissionSnapshot,
  PermissionState,
} from "./types";

// --- persistence -----------------------------------------------------------

type LocationPermissionFlags = {
  /** Set once we've shown the in-app background-location disclosure. */
  backgroundDisclosureShown: boolean;
  /** Set once we've actually fired the OS background request. */
  backgroundRequested: boolean;
};

/**
 * Persists one-shot flags so we don't re-nag the driver across launches.
 * Foreground re-prompting is governed by the OS (`canAskAgain`); the flags
 * here only guard *our* disclosure UI, never the OS prompt itself.
 */
export const locationPermissionStore = new Storage<[], LocationPermissionFlags>(
  { id: "LOCATION_PERMISSION_FLAGS" },
);

// --- helpers ---------------------------------------------------------------

/**
 * Collapse Expo's (status, canAskAgain) pair into our normalised state.
 *  - granted                       → "granted"
 *  - undetermined                  → "undetermined"
 *  - denied & can ask again        → "denied"
 *  - denied & cannot ask again     → "blocked"
 */
function toPermissionState(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
): PermissionState {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.UNDETERMINED) return "undetermined";
  return canAskAgain ? "denied" : "blocked";
}

/** Resolve a promise to `null` if it doesn't settle within `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new LocationPermissionError("timeout", `Timed out after ${ms}ms`),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class LocationPermissionServiceImpl {
  /**
   * Read the full, current permission picture without prompting the user.
   * Safe to call on every app resume — it only inspects existing state.
   */
  async getStatus(): Promise<LocationPermissionSnapshot> {
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      // Web / unknown — report a benign "undetermined / no services" snapshot.
      return {
        foreground: "undetermined",
        background: "undetermined",
        servicesEnabled: false,
        preciseLocation: false,
        iosScope: null,
        canAskForeground: false,
        canAskBackground: false,
      };
    }

    try {
      // Read foreground, background and the GPS toggle in parallel.
      const [fg, bg, servicesEnabled] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
        Location.hasServicesEnabledAsync(),
      ]);

      const iosScope: IosScope =
        Platform.OS === "ios" ? (fg.ios?.scope ?? null) : null;

      const preciseLocation =
        Platform.OS === "ios"
          ? fg.ios?.accuracy !== "reduced"
          : fg.android?.accuracy !== "coarse";

      return {
        foreground: toPermissionState(fg.status, fg.canAskAgain),
        background: toPermissionState(bg.status, bg.canAskAgain),
        servicesEnabled,
        preciseLocation,
        iosScope,
        canAskForeground: fg.canAskAgain,
        canAskBackground: bg.canAskAgain,
      };
    } catch (error) {
      throw new LocationPermissionError(
        "unknown",
        "Failed to read location permission status",
        error,
      );
    }
  }

  /** True once foreground location is usable (granted + services on). */
  async isForegroundReady(): Promise<boolean> {
    const s = await this.getStatus();
    return s.foreground === "granted" && s.servicesEnabled;
  }

  /** True once background ("always") location is usable. */
  async isBackgroundReady(): Promise<boolean> {
    const s = await this.getStatus();
    return s.background === "granted" && s.servicesEnabled;
  }

  // --- foreground ----------------------------------------------------------

  /**
   * Request foreground (while-in-use) location.
   *
   * Returns a typed result; never throws for the expected denied/blocked
   * paths. The caller decides whether to show a rationale, an "open Settings"
   * CTA, or to proceed.
   */
  async requestForeground(): Promise<LocationPermissionResult> {
    const before = await this.getStatus();

    // Already granted — short-circuit, no prompt, no loop.
    if (before.foreground === "granted") {
      return { granted: true, state: "granted", snapshot: before };
    }

    // Permanently blocked — the OS won't show a prompt; Settings is the only path.
    if (before.foreground === "blocked" || !before.canAskForeground) {
      return {
        granted: false,
        state: "blocked",
        code: "blocked",
        message:
          "Foreground location is blocked; user must enable in Settings.",
        snapshot: before,
      };
    }

    let response: Location.LocationPermissionResponse;
    try {
      // 12s guard: on rare OEM ROMs the dialog callback can hang.
      response = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        12_000,
      );
    } catch (error) {
      if (error instanceof LocationPermissionError) {
        return {
          granted: false,
          state: before.foreground,
          code: error.code,
          message: error.message,
          snapshot: before,
        };
      }
      throw new LocationPermissionError(
        "unknown",
        "Foreground permission request failed",
        error,
      );
    }

    const snapshot = await this.getStatus();
    if (response.status === Location.PermissionStatus.GRANTED) {
      return { granted: true, state: "granted", snapshot };
    }

    const state = toPermissionState(response.status, response.canAskAgain);
    return {
      granted: false,
      state: state as Exclude<PermissionState, "granted">,
      code: state === "blocked" ? "blocked" : "denied",
      message: `Foreground permission ${state}.`,
      snapshot,
    };
  }

  // --- background ----------------------------------------------------------

  /**
   * Request background ("always" / "allow all the time") location.
   *
   * IMPORTANT sequencing rules enforced here:
   *  - Foreground MUST already be granted (Android 10+ and iOS both reject an
   *    out-of-order background request). We fail fast with `foreground_required`.
   *  - On Android 11+ (API 30+) the OS does NOT show an in-app dialog; it can
   *    only be granted from the system Settings page ("Allow all the time").
   *    `requestBackgroundPermissionsAsync` will return without changing state,
   *    so when it stays un-granted we surface `blocked` and let the UI route
   *    the user to Settings.
   */
  async requestBackground(): Promise<LocationPermissionResult> {
    const before = await this.getStatus();

    if (before.background === "granted") {
      return { granted: true, state: "granted", snapshot: before };
    }

    // Hard requirement: foreground first.
    if (before.foreground !== "granted") {
      return {
        granted: false,
        // `before.background` is necessarily non-granted here (granted returned above).
        state: before.background as Exclude<PermissionState, "granted">,
        code: "foreground_required",
        message: "Foreground permission must be granted before background.",
        snapshot: before,
      };
    }

    locationPermissionStore.set(["backgroundRequested"], true);

    let response: Location.PermissionResponse;
    try {
      response = await withTimeout(
        Location.requestBackgroundPermissionsAsync(),
        12_000,
      );
    } catch (error) {
      if (error instanceof LocationPermissionError) {
        return {
          granted: false,
          state: before.background,
          code: error.code,
          message: error.message,
          snapshot: before,
        };
      }
      throw new LocationPermissionError(
        "unknown",
        "Background permission request failed",
        error,
      );
    }

    const snapshot = await this.getStatus();
    if (response.status === Location.PermissionStatus.GRANTED) {
      return { granted: true, state: "granted", snapshot };
    }

    const state = toPermissionState(response.status, response.canAskAgain);
    // On Android 11+ the request can resolve "denied" simply because no dialog
    // is shown — the real path is Settings, so treat any non-grant as needing
    // the Settings CTA (code "blocked") unless the OS says it can still ask.
    const code =
      snapshot.canAskBackground && state === "denied" ? "denied" : "blocked";
    return {
      granted: false,
      state: state as Exclude<PermissionState, "granted">,
      code,
      message: `Background permission ${state}.`,
      snapshot,
    };
  }

  // --- GPS / location services --------------------------------------------

  /** Whether device-level location services (GPS) are switched on. */
  async areServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  }

  /**
   * Ensure GPS is on, prompting the user where the platform allows it.
   *
   *  - Android: `enableNetworkProviderAsync()` shows the native "Turn on
   *    location?" dialog (the same one Google Maps uses). Resolves once the
   *    user accepts; rejects if they decline.
   *  - iOS: there is NO programmatic way to toggle location services. We can
   *    only report the state; the caller should guide the user to Settings.
   *
   * Returns true if services are (now) enabled.
   */
  async ensureServicesEnabled(): Promise<boolean> {
    if (await this.areServicesEnabled()) return true;

    if (Platform.OS === "android") {
      try {
        await Location.enableNetworkProviderAsync();
        return await this.areServicesEnabled();
      } catch {
        // User dismissed the system dialog.
        return false;
      }
    }

    // iOS — cannot prompt; report current (off) state.
    return false;
  }

  // --- settings deep-links -------------------------------------------------

  /**
   * Open this app's settings page so the user can flip a blocked permission.
   * Works on both platforms via `Linking.openSettings()`.
   */
  async openAppSettings(): Promise<void> {
    try {
      await Linking.openSettings();
    } catch (error) {
      throw new LocationPermissionError(
        "unknown",
        "Could not open app settings",
        error,
      );
    }
  }

  /**
   * Open the device-level *location* settings (the GPS master toggle).
   *  - Android: deep-links straight to the Location source settings screen.
   *  - iOS: no such deep-link exists, so we fall back to the app settings page.
   */
  async openLocationSettings(): Promise<void> {
    if (Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS,
        );
        return;
      } catch {
        // Fall through to generic app settings.
      }
    }
    await this.openAppSettings();
  }

  // --- disclosure flags ----------------------------------------------------

  hasShownBackgroundDisclosure(): boolean {
    return locationPermissionStore.get(["backgroundDisclosureShown"]) === true;
  }

  markBackgroundDisclosureShown(): void {
    locationPermissionStore.set(["backgroundDisclosureShown"], true);
  }

  /** Reset one-shot flags (e.g. on logout). */
  resetFlags(): void {
    locationPermissionStore.clearAll();
  }
}

/** Singleton — import this everywhere. */
export const LocationPermissionService = new LocationPermissionServiceImpl();
export type { LocationPermissionServiceImpl };
