/**
 * Whether a failed request failed *because the token expired*, as opposed to
 * any other 401.
 *
 * Deliberately narrow. The backend sets `x-expired-token: true` for exactly
 * this case (`auth_middleware.rs`) and returns a bare 401 for everything else,
 * including business-logic refusals such as the 2FA endpoints' API-key check.
 * Treating every 401 as an expiry would sign drivers out over an authorisation
 * error on one screen.
 *
 * Known gap: a token rejected as *malformed* — which is what every existing
 * token becomes if the server's JWT secret is ever rotated — carries no header
 * and so does not trigger a logout. Those drivers would need to clear the app
 * or reinstall. Rotating that secret is already a fleet-wide event; this is one
 * more reason not to.
 *
 * Kept apart from `sessionExpiry` so it stays free of any axios import and can
 * be tested against a plain object.
 */
export function isExpiredTokenResponse(err: unknown): boolean {
  const response = (
    err as { response?: { status?: number; headers?: unknown } } | undefined
  )?.response;
  if (!response || response.status !== 401) return false;

  const headers = response.headers;
  if (!headers || typeof headers !== "object") return false;

  // Axios lowercases response header names, but `headers` may also be an
  // AxiosHeaders instance rather than a plain object, so read it defensively
  // rather than assuming either shape.
  const raw = (headers as Record<string, unknown>)["x-expired-token"];
  return typeof raw === "string" && raw.toLowerCase() === "true";
}
