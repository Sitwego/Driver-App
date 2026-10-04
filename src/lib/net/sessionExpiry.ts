/**
 * Bridges "the backend says this token is expired" to "log the driver out".
 *
 * The two halves cannot import each other. `useApiClient` is what sees the
 * response, `UserStateProvider` is what owns `logout()`, and userState already
 * imports the API hooks — wiring them directly would close that loop. This
 * module is deliberately dependency-free (no React, no react-native) so both
 * sides can import it, and so it can be unit-tested in plain Node.
 *
 * The token lasts 90 days and the session is persisted, so this fires rarely —
 * which is exactly why it has to be right. Until it existed, an expired token
 * left the driver in a signed-in app where every request failed and no path led
 * back to the login screen.
 */

type Handler = () => void;

let handler: Handler | undefined;
let alreadyFired = false;

/**
 * Registers what to do when the session expires. Called once, by
 * `UserStateProvider`.
 */
export function setSessionExpiredHandler(next: Handler | undefined): void {
  handler = next;
}

/**
 * Reports that the backend rejected a token as expired.
 *
 * Fires the handler AT MOST ONCE per session. An expiry does not arrive as one
 * failure: the token dies between requests, so every screen polling in the
 * background 401s at the same moment. Without this guard a single expiry would
 * run the whole logout — clearing five stores, the query cache and Firebase —
 * once per in-flight request.
 */
export function notifySessionExpired(): void {
  if (alreadyFired) return;
  alreadyFired = true;
  handler?.();
}

/**
 * Re-arms the guard. Called on a successful login, so the *next* expiry is
 * reported — without this, a driver could only ever be auto-logged-out once per
 * app launch.
 */
export function resetSessionExpiry(): void {
  alreadyFired = false;
}

/** Whether an expiry has already been reported. Exposed for tests. */
export function hasFiredSessionExpiry(): boolean {
  return alreadyFired;
}
