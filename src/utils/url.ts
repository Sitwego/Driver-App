// ─── Mutable file-server base URL ref ────────────────────────────────────────
// Initialised to the compile-time fallback. RemoteConfigProvider overwrites
// this once at startup, before any component renders. Never persisted to disk.

let _fileBaseUrl = "https://backend-api.sitwego.xyz/";

/** Called once by RemoteConfigProvider after Remote Config is fetched. */
export function setFileBaseUrl(url: string): void {
  if (url) _fileBaseUrl = url;
}

/** Returns the current file-server base URL (may have been updated by Remote Config). */
export function getFileBaseUrl(): string {
  return _fileBaseUrl;
}

export function createProfileImageUrl(
  id: string,
  fileId: string,
  path: string,
): string {
  return `${_fileBaseUrl}${path}/${id}/${fileId}`;
}
