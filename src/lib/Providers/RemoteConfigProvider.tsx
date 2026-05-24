/**
 * RemoteConfigProvider
 *
 * Initialises Firebase App Check, then fetches Remote Config at app startup
 * and exposes values through React Context. Blocks rendering until the first
 * fetch completes (or falls back to compile-time defaults on network failure)
 * so that no child provider ever runs with a stale base URL.
 *
 * APP CHECK — UNPUBLISHED APP
 * ───────────────────────────
 * Play Integrity requires the app to exist on Play Console (even internal
 * testing track). Until then, use the debug provider:
 *
 *  __DEV__  → "debug" provider  (a one-time token you register in the console)
 *  release  → "playIntegrity"   (switch once the app is on any Play track)
 *
 * First-run debug token setup:
 *  1. Run a debug build (`expo run:android` / USB).
 *  2. Open Logcat and filter for "FirebaseAppCheck".
 *     You'll see: "Enter this debug secret into the allow-list: XXXXXXXX-…"
 *  3. Firebase console → App Check → your Android app → Manage debug tokens
 *     → Add token → paste the value → Save.
 *  4. All subsequent debug builds on that machine pass App Check automatically.
 *
 * SECURITY NOTES
 * ──────────────
 * • Values are held in React state (heap memory) only — never written to
 *   AsyncStorage, MMKV, or any on-disk cache.
 * • Remote Config is public-readable by any client that has your
 *   google-services.json. App Check is what gates it to genuine binaries.
 * • Do NOT store secrets here that must stay server-side (private API keys,
 *   JWT signing keys, Stripe secret key, database credentials). Those belong
 *   in Cloud Functions / your backend.
 *
 * WHAT BELONGS IN REMOTE CONFIG
 * ──────────────────────────────
 * ✓ API base URLs            ✓ Feature flags
 * ✓ Public CDN / image hosts  ✓ Tunable timeouts / limits
 * ✗ Stripe *secret* key       ✗ JWT signing secret
 * ✗ DB password               ✗ Server-side private keys
 *
 * FIREBASE CONSOLE SETUP
 * ──────────────────────
 * 1. App Check → Register app → choose "Play Integrity" (release) or enable
 *    debug tokens (dev). Enforce App Check on Remote Config in the console.
 * 2. Remote Config → Create configuration → add API_BASE_URL, FILE_BASE_URL
 *    with production values → Publish.
 */

import appCheck from "@react-native-firebase/app-check";
import remoteConfig from "@react-native-firebase/remote-config";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  NativeModules,
  StyleSheet,
  View,
} from "react-native";

import { setFileBaseUrl } from "../../utils/url";

// ─── Config shape ────────────────────────────────────────────────────────────

export type AppConfig = {
  /** Primary REST API base URL */
  API_BASE_URL: string;
  /** File-upload / profile-image server base URL */
  FILE_BASE_URL: string;
};
// ─── Compile-time fallbacks ───────────────────────────────────────────────────
// These are used when Remote Config is unreachable (offline, first launch, etc.).
// They are also registered as Remote Config default values so the SDK never
// returns an empty string before the first successful fetch.

const DEFAULTS: AppConfig = {
  API_BASE_URL: __DEV__
    ? (process.env.EXPO_PUBLIC_API_BASE_URL_DEV ?? "")
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? ""),
  FILE_BASE_URL: process.env.EXPO_PUBLIC_FILE_BASE_URL ?? "",
};

// Dev: always fetch fresh (0 ms minimum interval).
// Prod: honour the 1-hour Remote Config cache to avoid quota hits.
const MIN_FETCH_INTERVAL_MS = __DEV__ ? 0 : 3_600_000;

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfigContext = createContext<AppConfig>(DEFAULTS);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RemoteConfigProvider({ children }: { children: ReactNode }) {
  // null = still loading; AppConfig = ready (fetched or fell back to defaults)
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    (async () => {
      // In dev, Remote Config holds production URLs — skip the fetch entirely
      // and use the compile-time dev defaults (BuildConfig / DEFAULTS).
      if (__DEV__) {
        setFileBaseUrl(DEFAULTS.FILE_BASE_URL);
        // Pass empty strings so native keeps its BuildConfig debug defaults.
        NativeModules.AppConfig?.update("", DEFAULTS.API_BASE_URL, "");
        setConfig(DEFAULTS);
        return;
      }

      try {
        // ── App Check ──────────────────────────────────────────────────────
        // Must run before any Firebase service call.
        // Debug provider: SDK prints a token to Logcat on first run — register
        // it in Firebase console → App Check → your app → Manage debug tokens.
        // Switch android.provider to "playIntegrity" once the app is on any
        // Play Console track (internal testing is enough).
        const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
        provider.configure({
          android: {
            provider: "playIntegrity",
          },
          apple: {
            provider: "deviceCheck",
          },
        });
        await appCheck().initializeAppCheck({
          provider,
          isTokenAutoRefreshEnabled: true,
        });

        // ── Remote Config ──────────────────────────────────────────────────
        const rc = remoteConfig();

        await rc.setConfigSettings({
          minimumFetchIntervalMillis: MIN_FETCH_INTERVAL_MS,
        });

        // Register compile-time fallbacks so getValue() never returns "".
        await rc.setDefaults(DEFAULTS);

        // fetchAndActivate: fetches from Firebase then atomically activates.
        // Returns true if new values were activated, false if cache was used.
        await rc.fetchAndActivate();

        console.log("RemoteConfigProvider fetched from Firebase:", {
          API_BASE_URL: rc.getValue("API_BASE_URL").asString(),
          FILE_BASE_URL: rc.getValue("FILE_BASE_URL").asString(),
          LOCATION_UPDATE_ENDPOINT: rc
            .getValue("LOCATION_UPDATE_ENDPOINT")
            .asString(),
        });

        const loaded: AppConfig = {
          API_BASE_URL:
            rc.getValue("API_BASE_URL").asString() || DEFAULTS.API_BASE_URL,
          FILE_BASE_URL:
            rc.getValue("FILE_BASE_URL").asString() || DEFAULTS.FILE_BASE_URL,
        };

        // Push into module-level refs so axios picks them up immediately.
        // This is the only place these values leave the JS heap — they are
        // NOT written to any persistent storage.
        setFileBaseUrl(loaded.FILE_BASE_URL);

        // Push native-only URLs into AppConfig (gRPC server, location endpoint).
        // Empty string means "keep the BuildConfig default".
        NativeModules.AppConfig?.update(
          rc.getValue("GRPC_SERVER_URL").asString(),
          loaded.API_BASE_URL,
          rc.getValue("LOCATION_UPDATE_ENDPOINT").asString(),
        );

        setConfig(loaded);
        console.log("RemoteConfigProvider loaded config:", loaded);
      } catch {
        console.warn(
          "RemoteConfigProvider failed to fetch from Firebase. Falling back to defaults.",
        );
        // Firebase unreachable (no network, quota, etc.) — fall back to the
        // compile-time defaults so the app still works offline.
        setFileBaseUrl(DEFAULTS.FILE_BASE_URL);
        setConfig(DEFAULTS);
      }
    })();
  }, []);

  if (!config) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access runtime config values anywhere in the tree.
 *
 * @example
 * const { API_BASE_URL } = useConfig();
 */
export const useConfig = () => useContext(ConfigContext);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full-screen dark splash shown while Remote Config is being fetched.
  // Intentionally avoids any theme dependency so it can sit above ThemeProvider.
  splash: {
    flex: 1,
    backgroundColor: "#0F2424",
    alignItems: "center",
    justifyContent: "center",
  },
});
