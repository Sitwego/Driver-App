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
  saveTokenToSharedPreferences,
  canDrawOverlays,
  openOverlaySettings,
} = GeoKalmanModule;

const startBackgroundService = (token: string) => {
  startGeokalmanService(token);
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
  canDrawOverlays,
  openOverlaySettings,
};
