// ------------------------------------------------------------------
// Location permission — typed errors
// ------------------------------------------------------------------
import type { LocationPermissionErrorCode } from "./types";

/**
 * A typed error thrown only for *unexpected* failures (the underlying Expo
 * API rejected, the platform is unsupported, etc.).
 *
 * Expected outcomes — denied / blocked / services-off — are NOT thrown; they
 * are returned as `LocationPermissionResult` so the happy path stays free of
 * try/catch. Reserve this class for genuinely exceptional conditions.
 */
export class LocationPermissionError extends Error {
  readonly code: LocationPermissionErrorCode;
  /** The original error, if this wraps a lower-level failure. */
  readonly cause?: unknown;

  constructor(
    code: LocationPermissionErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "LocationPermissionError";
    this.code = code;
    this.cause = cause;
    // Restore prototype chain for `instanceof` after transpilation to ES5/Hermes.
    Object.setPrototypeOf(this, LocationPermissionError.prototype);
  }
}

/** User-facing copy for each error code. Centralised for i18n / reuse. */
export const PERMISSION_ERROR_COPY: Record<
  LocationPermissionErrorCode,
  { title: string; message: string }
> = {
  services_disabled: {
    title: "Turn on location",
    message:
      "Location services (GPS) are turned off. Please enable them so you can receive ride requests and share your location with passengers.",
  },
  foreground_required: {
    title: "Location access needed",
    message:
      "Please allow location access while using the app before enabling all-the-time access.",
  },
  blocked: {
    title: "Location permission blocked",
    message:
      "Location access is turned off for this app. Open Settings and allow location to keep receiving rides.",
  },
  denied: {
    title: "Location permission required",
    message:
      "We need your location to match you with nearby ride requests and keep passengers updated.",
  },
  unsupported_platform: {
    title: "Not supported",
    message: "Location is not supported on this device.",
  },
  timeout: {
    title: "Something went wrong",
    message: "The location request took too long. Please try again.",
  },
  unknown: {
    title: "Something went wrong",
    message: "We couldn't check your location permission. Please try again.",
  },
};
