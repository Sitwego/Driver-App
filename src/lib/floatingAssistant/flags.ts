// ----------------------------------------------------------------
// Feature flag for the floating ride assistant (the overlay bubble).
//
// Reads the Firebase Remote Config boolean `FLOATING_ASSISTANT_ENABLED`
// (registered as a default and fetched at startup by RemoteConfigProvider).
//
// There are two distinct "we don't know" cases and they are NOT the same:
//
//   1. The Remote Config module itself is missing/unusable — a broken build, or
//      Jest. Nothing can be trusted, so this fails CLOSED (false).
//   2. The module works but no fetch has succeeded yet — first launch, no
//      network, App Check not yet trusted. That is what the registered default
//      below answers, and it is deliberately ON.
//
// Case 2 used to also resolve false, which meant the feature could never
// bootstrap in a release build: a fresh install has no cached value, so a single
// Firebase hiccup left the bubble permanently invisible with no signal. The flag
// is still remote-killable — publishing `false` in the console turns it off on
// the next launch — but it no longer depends on a successful fetch to appear.
//
// Mirrors src/tracking/flags.ts: non-hook, dynamic require (keeps the node-only
// Jest config free of native imports), and a test/dev escape hatch.
//
// The native side keeps its OWN copy of this flag — the bubble can be started
// headless by BootReceiver after a reboot, long before any JS runs. See
// AppConfig.isFloatingAssistantEnabled(); RemoteConfigProvider pushes the
// resolved value across via AppConfigModule.
// ----------------------------------------------------------------

/** Remote Config key. Exported so the provider registers exactly this name. */
export const FLOATING_ASSISTANT_FLAG_KEY = "FLOATING_ASSISTANT_ENABLED";

/**
 * Value Remote Config resolves to before any successful fetch.
 *
 * Flip this to `false` to make the feature opt-in again. Note that turning it
 * off for users in the field is done from the Firebase console, not here — this
 * only governs devices that have never completed a fetch.
 */
export const FLOATING_ASSISTANT_DEFAULT = true;

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
    return remoteConfig
      .default()
      .getValue(FLOATING_ASSISTANT_FLAG_KEY)
      .asBoolean();
  } catch {
    // Case 1 above: the module is not usable at all. Fail closed.
    return false;
  }
}
