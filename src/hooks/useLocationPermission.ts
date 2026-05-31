// ------------------------------------------------------------------
// useLocationPermission
// ------------------------------------------------------------------
//
// Thin React layer over `LocationPermissionService`. It owns the reactive
// permission snapshot, keeps it fresh across app-state changes (the driver
// may toggle a permission in Settings and swipe back), and exposes the
// request/recovery actions to the UI.
//
// All heavy lifting lives in the service; this hook only adds React state,
// AppState wiring, and re-entrancy guards. React Compiler handles memoisation,
// so we deliberately avoid manual useCallback/useMemo here.

import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { LocationPermissionService } from "~/lib/location/LocationPermissionService";

import type {
  LocationPermissionResult,
  LocationPermissionSnapshot,
} from "~/lib/location/types";

export interface UseLocationPermission {
  /** Latest snapshot, or `null` until the first read resolves. */
  status: LocationPermissionSnapshot | null;
  /** True while the very first status read is in flight (before any data). */
  isLoading: boolean;
  /** True while a request is being processed (prevents double-taps). */
  isRequesting: boolean;

  /** Convenience flags derived from `status`. */
  isForegroundGranted: boolean;
  isBackgroundGranted: boolean;
  servicesEnabled: boolean;
  /** Foreground granted AND GPS on — safe to read a location. */
  isReady: boolean;

  /** Re-read status without prompting (e.g. after returning from Settings). */
  refresh: () => Promise<LocationPermissionSnapshot | null>;
  /** Prompt for foreground (while-in-use) location. */
  requestForeground: () => Promise<LocationPermissionResult>;
  /** Prompt for background ("always") location — foreground must be granted first. */
  requestBackground: () => Promise<LocationPermissionResult>;
  /** Ensure GPS is on (Android shows the native dialog; iOS reports only). */
  ensureServicesEnabled: () => Promise<boolean>;
  /** Open this app's settings page (recovery from a blocked permission). */
  openAppSettings: () => Promise<void>;
  /** Open device location settings (Android) or app settings (iOS). */
  openLocationSettings: () => Promise<void>;
}

export function useLocationPermission(): UseLocationPermission {
  const [status, setStatus] = useState<LocationPermissionSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  // Guards a request against AppState refreshes / double taps clobbering it,
  // and lets cleanup ignore late async results after unmount.
  const mountedRef = useRef(true);
  const requestingRef = useRef(false);

  const refresh = async (): Promise<LocationPermissionSnapshot | null> => {
    try {
      const snapshot = await LocationPermissionService.getStatus();
      if (mountedRef.current) {
        setStatus(snapshot);
        setIsLoading(false);
      }
      return snapshot;
    } catch {
      // getStatus only throws on truly unexpected failures; degrade gracefully.
      if (mountedRef.current) setIsLoading(false);
      return null;
    }
  };

  // Initial read + re-check whenever the app returns to the foreground. A
  // permission can change while we're backgrounded (user edits Settings), so
  // the snapshot must be refreshed on resume — but never while a prompt is
  // mid-flight, since the OS dialog itself backgrounds the app.
  useEffect(() => {
    mountedRef.current = true;
    // refresh() only sets state after an async read resolves (never synchronously
    // during the effect), so this does not cause a render-phase update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();

    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active" && !requestingRef.current) {
        refresh();
      }
    });

    return () => {
      mountedRef.current = false;
      sub.remove();
    };
  }, []);

  /** Run a request action behind the re-entrancy guard, then refresh state. */
  const runRequest = async (
    action: () => Promise<LocationPermissionResult>,
  ): Promise<LocationPermissionResult> => {
    requestingRef.current = true;
    if (mountedRef.current) setIsRequesting(true);
    try {
      const result = await action();
      if (mountedRef.current) setStatus(result.snapshot);
      return result;
    } finally {
      requestingRef.current = false;
      if (mountedRef.current) setIsRequesting(false);
    }
  };

  const requestForeground = () =>
    runRequest(() => LocationPermissionService.requestForeground());

  const requestBackground = () =>
    runRequest(() => LocationPermissionService.requestBackground());

  const ensureServicesEnabled = async (): Promise<boolean> => {
    const enabled = await LocationPermissionService.ensureServicesEnabled();
    await refresh();
    return enabled;
  };

  const openAppSettings = () => LocationPermissionService.openAppSettings();
  const openLocationSettings = () =>
    LocationPermissionService.openLocationSettings();

  return {
    status,
    isLoading,
    isRequesting,
    isForegroundGranted: status?.foreground === "granted",
    isBackgroundGranted: status?.background === "granted",
    servicesEnabled: status?.servicesEnabled ?? false,
    isReady: status?.foreground === "granted" && status.servicesEnabled,
    refresh,
    requestForeground,
    requestBackground,
    ensureServicesEnabled,
    openAppSettings,
    openLocationSettings,
  };
}
