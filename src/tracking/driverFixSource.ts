// ----------------------------------------------------------------
// FixSource adapter over the app's native Kalman-filtered GPS stream
// (`onGeoKalman` from the location foreground service) — the real
// transport behind <VehicleTracker> on the driver's own device.
//
// seq is a module-level counter: the native emitter delivers in-order
// on a single device, so a monotonic counter is the honest ordering
// authority (and it keeps increasing across leg switches, matching
// the gate's expectations). ts is the arrival wall-clock — OnGpsData
// carries no measurement timestamp; on-device latency is ~0.
// ----------------------------------------------------------------

import { nativeAppEvents } from "~/lib/native";

import type { FixSource, LocationFix, Unsubscribe } from "./types";
import type { OnGpsData } from "~/utils/geo";

let seq = 0;

export const driverFixSource: FixSource = (onFix) => {
  const sub = nativeAppEvents.addListener("onGeoKalman", (d: OnGpsData) => {
    const fix: LocationFix = {
      seq: ++seq,
      ts: Date.now(),
      lat: d.latitude,
      lng: d.longitude,
      acc: d.accuracy,
      spd: d.speed,
      brg: d.bearing,
    };
    onFix(fix);
  });
  const unsubscribe: Unsubscribe = () => sub.remove();
  return unsubscribe;
};
