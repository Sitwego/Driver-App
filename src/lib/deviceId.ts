import * as Application from "expo-application";
import { Platform } from "react-native";

/**
 * The device identifier sent with a driver login, or `undefined` when this
 * device cannot supply one.
 *
 * This is the Android SSAID (`Settings.Secure.ANDROID_ID`). The backend never
 * stores it: it keeps `HMAC-SHA256(server pepper, "android:" || ssaid)`, and
 * uses that only to notice when several driver accounts are approved from one
 * handset. Nothing is blocked on the result — see
 * `backend_api/docs/device-identity.md`.
 *
 * Three properties make SSAID the right identifier here, and they are worth
 * knowing before anyone swaps it for something else:
 *
 *  - It survives reinstalling the app and clearing app data, which a
 *    per-install UUID does not. That is the entire point: an identifier that
 *    resets when the app is reinstalled cannot see someone re-registering
 *    after being removed.
 *  - It is scoped to (app-signing key, user, device), so it is not a
 *    cross-app tracking identifier and is not shared with anyone else.
 *  - It is not the advertising id. Play policy forbids linking GAID to
 *    persistent identifiers for this purpose, and IMEI/serial/MAC have been
 *    unavailable to normal apps since Android 10 and are a policy violation to
 *    even attempt.
 *
 * It resets on a factory reset, and it changes if the APK signing key changes
 * — so migrating to Play App Signing, or re-keying the app, silently restarts
 * the dataset from zero. That is a deploy-time consideration, not a bug.
 *
 * Android only, and deliberately so: `getAndroidId()` throws on iOS and web,
 * and the value iOS would return is unrelated to device identity. Failure is
 * silent — a driver must be able to log in and work when this is unavailable,
 * so every failure path returns `undefined` and the field is simply omitted.
 */
export function getDeviceId(): string | undefined {
  if (Platform.OS !== "android") return undefined;

  try {
    // Synchronous, and reads a value Android already has in memory, so this
    // adds nothing measurable to the login path.
    return Application.getAndroidId() || undefined;
  } catch {
    // Never surfaced to the driver. A login that works matters more than an
    // observation that is only ever used to answer a question offline.
    return undefined;
  }
}
