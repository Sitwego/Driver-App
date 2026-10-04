// ------------------------------------------------------------------
// OverlayPermissionService
// ------------------------------------------------------------------
//
// Policy for the "Appear on top" (SYSTEM_ALERT_WINDOW) permission the floating
// ride assistant needs.
//
// Structured like LocationPermissionService (see src/lib/location/README.md):
// no React, all OS calls in one place, one-shot flags persisted so the driver is
// never re-nagged, and expected outcomes returned rather than thrown.
//
// The permission itself is an appop, not a runtime permission — there is no
// request API and no result callback, so the only thing we can do is explain why
// and open the right settings screen. The OEM-specific work of finding that
// screen already lives in native OverlaySettings.java.

import { Alert, Platform } from "react-native";

import { canDrawOverlays, openOverlaySettings } from "~/lib/native";
import { Storage } from "~/lib/store";

type OverlayPermissionFlags = {
  /** Set once the driver has been shown the rationale for this permission. */
  rationaleShown: boolean;
};

/**
 * One-shot flags so the rationale is shown at most once per install.
 *
 * Cleared on logout alongside the other stores, so the next driver on a shared
 * device gets the explanation rather than inheriting a silent decline.
 */
export const overlayPermissionStore = new Storage<[], OverlayPermissionFlags>({
  id: "OVERLAY_PERMISSION_FLAGS",
});

/** Whether the app currently holds the overlay permission. */
function isGranted(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    return !!canDrawOverlays();
  } catch {
    // Bridge unavailable. Report "no permission" so every caller degrades to the
    // no-bubble path rather than assuming an overlay it may not be able to draw.
    return false;
  }
}

/**
 * Explain the floating assistant once, then offer to open Settings.
 *
 * Declining is a complete no-op: the caller does not branch on the result and
 * nothing downstream is blocked. Ride requests keep arriving through push and
 * the in-app modal, which is why this can afford to be a one-time, ignorable
 * offer rather than a gate.
 *
 * @returns true if the rationale was shown on this call.
 */
function promptOnce(): boolean {
  if (Platform.OS !== "android") return false;
  if (isGranted()) return false;
  if (overlayPermissionStore.get(["rationaleShown"])) return false;

  overlayPermissionStore.set(["rationaleShown"], true);
  Alert.alert(
    "Floating Ride Assistant",
    "Stay connected to your rides while using Maps or other apps. Sitwego will show a small floating ride indicator while you're online.",
    [
      { text: "Not Now", style: "cancel" },
      { text: "Enable Floating Assistant", onPress: () => openSettings() },
    ],
  );
  return true;
}

function openSettings(): void {
  try {
    openOverlaySettings();
  } catch {
    // Every OEM fallback already failed inside the native module; there is
    // nowhere else to send the driver, and this must not break going online.
  }
}

/** Re-arm the rationale, e.g. on logout. */
function reset(): void {
  overlayPermissionStore.clearAll();
}

export const OverlayPermissionService = {
  isGranted,
  promptOnce,
  openSettings,
  reset,
};
