import React, { useEffect, memo, useMemo, useState, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { useRideRequestStatus } from "~/lib/Providers/UseRideRequestProvider";
import { rideStore, useStorage } from "~/lib/store";
import ReText from "~/ui/retext";

const WAITING_THRESHOLD_SECONDS = 5 * 60; // 5 minutes free waiting window

const formatMmSs = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/**
 * Below the 5-minute threshold: normal MM:SS display.
 * Above it: the threshold time is frozen and only the overtime increments.
 *   e.g. "05:00 (+02:30)"
 */
const formatElapsed = (totalSeconds: number): string => {
  if (totalSeconds <= WAITING_THRESHOLD_SECONDS) {
    return formatMmSs(totalSeconds);
  }
  const overtime = totalSeconds - WAITING_THRESHOLD_SECONDS;
  return `${formatMmSs(WAITING_THRESHOLD_SECONDS)} (+${formatMmSs(overtime)})`;
};

/**
 * Owns the shared value AND all mutations of it inside a single hook scope —
 * required for React Compiler compatibility (mutating a value returned from
 * another hook is not allowed).
 */
function useElapsedTimer(arrivedAt: number | undefined, isRunning: boolean) {
  const formattedTime = useSharedValue("00:00");

  useEffect(() => {
    if (!arrivedAt) {
      formattedTime.value = "00:00";
      return;
    }
    if (!isRunning) {
      // Ride has started — freeze on the last elapsed value, don't reset.
      return;
    }

    // Compute immediately — no waiting for the first interval tick.
    // Correct elapsed time on every mount/remount (navigation, app restart, etc.).
    formattedTime.value = formatElapsed(
      Math.floor((Date.now() - arrivedAt) / 1000),
    );

    // setInterval is BackgroundTimer.setInterval on Android (patched in index.ts),
    // so this keeps ticking even when the app is backgrounded.
    const timerId = setInterval(() => {
      formattedTime.value = formatElapsed(
        Math.floor((Date.now() - arrivedAt) / 1000),
      );
    }, 1000);

    return () => clearInterval(timerId);
  }, [arrivedAt, isRunning, formattedTime]);

  return formattedTime;
}

const OVERTIME_RATE_PER_MINUTE = 10; // KSH charged per extra minute beyond threshold

/**
 * Returns the extra fare (in KSH) accrued while the driver waits beyond the
 * 5-minute free window. Updates at most once per minute. Returns 0 when the
 * timer is not running or hasn't crossed the threshold yet.
 */
export function useOvertimeCharge(): number {
  const { rideStatus } = useRideRequestStatus();

  const hasDriverArrived = rideStatus?.rideStatus?.hasDriverArrived ?? false;
  const hasRideStarted = rideStatus?.rideStatus?.hasRideStarted ?? false;
  const isRunning = hasDriverArrived && !hasRideStarted;

  // Both reactive MMKV subscriptions — re-run the effect automatically
  // when arrivedAt or overtimeCharge are written from anywhere in the app.
  const [arrivedAt] = useStorage(rideStore, ["arrivedAt"]);
  const [storedCharge, persistCharge] = useStorage(rideStore, [
    "overtimeCharge",
  ]);

  const [charge, setCharge] = useState(() => {
    // On mount after ride has started: restore from MMKV, not from computation.
    if (hasRideStarted) return storedCharge ?? 0;
    if (!arrivedAt) return 0;
    const elapsed = Math.floor((Date.now() - arrivedAt) / 1000);
    if (elapsed <= WAITING_THRESHOLD_SECONDS) return 0;
    return (
      Math.floor((elapsed - WAITING_THRESHOLD_SECONDS) / 60) *
      OVERTIME_RATE_PER_MINUTE
    );
  });

  // Always-current charge value accessible inside the effect without adding
  // `charge` to the dependency array (which would restart the interval).
  const chargeRef = useRef(charge);
  chargeRef.current = charge;

  useEffect(() => {
    if (hasRideStarted) {
      // Ride has started — freeze the display and persist the final charge so
      // it survives app restarts and navigation away from this screen.
      if (chargeRef.current > 0) persistCharge(chargeRef.current);
      return;
    }

    if (!arrivedAt || !isRunning) {
      setCharge(0);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - arrivedAt) / 1000);
      const next =
        elapsed <= WAITING_THRESHOLD_SECONDS
          ? 0
          : Math.floor((elapsed - WAITING_THRESHOLD_SECONDS) / 60) *
            OVERTIME_RATE_PER_MINUTE;
      setCharge((prev) => (prev === next ? prev : next));
    };

    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [arrivedAt, isRunning, hasRideStarted, persistCharge]);

  return charge;
}

const TimerComponent: React.FC = () => {
  const { rideStatus } = useRideRequestStatus();

  const isRunning = useMemo(
    () =>
      (rideStatus?.rideStatus?.hasDriverArrived ?? false) &&
      !(rideStatus?.rideStatus?.hasRideStarted ?? false),
    [
      rideStatus?.rideStatus?.hasDriverArrived,
      rideStatus?.rideStatus?.hasRideStarted,
    ],
  );

  // Prefer the context value (live state); fall back to the persisted store key
  // so the correct time is shown immediately after an app restart before the
  // provider has dispatched any new actions.
  const arrivedAt = useMemo(
    () => rideStatus?.rideStatus?.arrivedAt ?? rideStore.get(["arrivedAt"]),
    [rideStatus?.rideStatus?.arrivedAt],
  );

  const formattedTime = useElapsedTimer(arrivedAt, isRunning);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isRunning ? 1.1 : 1, { duration: 300 }) }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ReText text={formattedTime} style={styles.timerText} />
    </Animated.View>
  );
};

export default memo(TimerComponent);

const styles = StyleSheet.create({
  timerText: {
    fontSize: 18,
    color: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
});
