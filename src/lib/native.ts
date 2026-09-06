import { NativeModules, NativeEventEmitter } from "react-native";

export const { GeoKalmanModule } = NativeModules;
const nativeAppEvents = new NativeEventEmitter(GeoKalmanModule);

const {
  startGeokalmanService,
  stopGeokalmanService,
  startEventService,
  stopEventService,
  getETA,
  isDriverOnline,
  isGeokalmanServiceRunning,
  saveTokenToSharedPreferences,
  canDrawOverlays,
  openOverlaySettings,
  consumePendingRideRequest,
  clearPendingRideRequest,
  refreshRideBubble,
  syncRideBubble,
  consumeBubbleLaunchTarget,
} = GeoKalmanModule;

const startBackgroundService = (token: string) => {
  startGeokalmanService(token);
};

/**
 * "Appear on top" (SYSTEM_ALERT_WINDOW) permission.
 *
 * The permission cannot be granted programmatically — it is an appop, so there
 * is no request API and the user has to flip the toggle themselves. `open()`
 * deep-links straight to this app's toggle rather than the app list, and
 * resolves false if no settings screen could be opened at all.
 */
export const OverlaySettings = NativeModules.OverlaySettings as {
  canDrawOverlays: () => boolean;
  open: () => Promise<boolean>;
};
export {
  nativeAppEvents,
  startBackgroundService,
  startEventService,
  stopEventService,
  stopGeokalmanService,
  getETA,
  saveTokenToSharedPreferences,
  isDriverOnline,
  isGeokalmanServiceRunning,
  canDrawOverlays,
  openOverlaySettings,
  consumePendingRideRequest,
  clearPendingRideRequest,
  refreshRideBubble,
  syncRideBubble,
  consumeBubbleLaunchTarget,
};
