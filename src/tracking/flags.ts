// ----------------------------------------------------------------
// Step 7 — feature flag for the smooth-tracking pipeline.
//
// Reads the Firebase Remote Config boolean `SMOOTH_VEHICLE_TRACKING`
// (fetched + activated at startup by RemoteConfigProvider). Fails
// CLOSED: any error — firebase unavailable, key missing, running
// under Jest — means the naive marker ships, matching pre-pipeline
// behavior. Dev builds default ON so the pipeline is exercised.
// ----------------------------------------------------------------

const FLAG_KEY = "SMOOTH_VEHICLE_TRACKING";

/** Test/dev escape hatch: overrides every other source when non-null. */
let overrideValue: boolean | null = null;

export function __setSmoothTrackingOverride(value: boolean | null): void {
  overrideValue = value;
}

export function isSmoothTrackingEnabled(): boolean {
  if (overrideValue !== null) return overrideValue;
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  try {
    // Dynamic require: keeps Jest (plain Node) free of native imports.
    const remoteConfig =
      require("@react-native-firebase/remote-config") as typeof import("@react-native-firebase/remote-config");
    return remoteConfig.default().getValue(FLAG_KEY).asBoolean();
  } catch {
    return false;
  }
}
