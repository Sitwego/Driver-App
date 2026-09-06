// ----------------------------------------------------------------
// Feature flag for the floating ride assistant (the overlay bubble).
//
// Reads the Firebase Remote Config boolean `FLOATING_ASSISTANT_ENABLED`
// (fetched + activated at startup by RemoteConfigProvider). Fails
// CLOSED: any error — firebase unavailable, key missing, running
// under Jest — means no bubble, matching the pre-feature behaviour.
// Dev builds default ON so the overlay is exercised.
//
// Mirrors src/tracking/flags.ts deliberately: same shape, same
// dynamic require (keeps the node-only Jest config free of native
// imports), same test/dev escape hatch.
//
// The native side keeps its OWN copy of this flag — the bubble can be
// started headless by BootReceiver after a reboot, long before any JS
// runs. See AppConfig.isFloatingAssistantEnabled(); RemoteConfigProvider
// pushes the resolved value across via AppConfigModule.
// ----------------------------------------------------------------

const FLAG_KEY = "FLOATING_ASSISTANT_ENABLED";

/** Test/dev escape hatch: overrides every other source when non-null. */
let overrideValue: boolean | null = null;

export function __setFloatingAssistantOverride(value: boolean | null): void {
  overrideValue = value;
}

export function isFloatingAssistantEnabled(): boolean {
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
