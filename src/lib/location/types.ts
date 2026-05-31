// ------------------------------------------------------------------
// Location permission — shared type definitions
// ------------------------------------------------------------------
//
// These types form the public contract of the location-permission module.
// They are intentionally framework-agnostic (no React imports) so the
// service can be unit-tested in isolation and reused outside of components.

/**
 * Normalised permission state used across the app.
 *
 * We collapse Expo's (`status` + `canAskAgain`) pair into a single,
 * exhaustive union so callers never have to reason about the two flags
 * separately:
 *
 *  - `granted`        — permission is available, location can be read.
 *  - `denied`         — refused, but the OS will still show a prompt next time.
 *  - `blocked`        — refused permanently ("Don't ask again" / iOS hard-deny).
 *                       The only recovery path is the system Settings screen.
 *  - `undetermined`   — never requested yet.
 */
export type PermissionState = "granted" | "denied" | "blocked" | "undetermined";

/** Which level of location access we are talking about. */
export type PermissionLevel = "foreground" | "background";

/**
 * iOS authorisation scope. On Android this is always `null`.
 *  - `whenInUse` — granted only while the app is in the foreground.
 *  - `always`    — granted for background use as well ("Allow all the time").
 */
export type IosScope = "whenInUse" | "always" | "none" | null;

/**
 * A complete, point-in-time snapshot of everything the app needs to know
 * about location availability. Produced by `LocationPermissionService.getStatus()`.
 */
export interface LocationPermissionSnapshot {
  /** Foreground (while-in-use) permission state. */
  foreground: PermissionState;
  /** Background ("always" / "allow all the time") permission state. */
  background: PermissionState;
  /**
   * Whether device-level location services (GPS) are switched on.
   * Permission can be granted while the GPS toggle is off — both are required
   * before a fix can be obtained.
   */
  servicesEnabled: boolean;
  /**
   * Whether the granted accuracy is precise (fine GPS) rather than approximate.
   * Android 12+ lets the user grant only coarse location; iOS 14+ has a
   * "Precise: Off" toggle. Ride-hailing requires precise location.
   */
  preciseLocation: boolean;
  /** iOS authorisation scope, or `null` on Android. */
  iosScope: IosScope;
  /** Whether the OS will still present a foreground prompt if we ask. */
  canAskForeground: boolean;
  /** Whether the OS will still present a background prompt if we ask. */
  canAskBackground: boolean;
}

/** Reason codes for a request that did not end in `granted`. */
export type LocationPermissionErrorCode =
  | "services_disabled" // GPS / location services are turned off
  | "foreground_required" // tried to request background before foreground
  | "blocked" // permanently denied — must open Settings
  | "denied" // denied this time, can ask again later
  | "unsupported_platform" // e.g. web / unknown platform
  | "timeout" // the OS prompt never resolved in time
  | "unknown"; // unexpected failure from the underlying API

/**
 * Result of a permission request. Discriminated on `granted` so callers can
 * branch with full type-safety:
 *
 *   const res = await service.requestForeground();
 *   if (res.granted) { startTracking(); }
 *   else if (res.code === "blocked") { showOpenSettings(); }
 */
export type LocationPermissionResult =
  | { granted: true; state: "granted"; snapshot: LocationPermissionSnapshot }
  | {
      granted: false;
      state: Exclude<PermissionState, "granted">;
      code: LocationPermissionErrorCode;
      /** Human-readable detail, safe to log (never contains PII). */
      message: string;
      snapshot: LocationPermissionSnapshot;
    };
