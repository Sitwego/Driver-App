// ----------------------------------------------------------------
// Where a floating-assistant tap should land.
//
// The bubble does not navigate. It records the state it was showing when
// tapped, opens the app, and leaves the decision here — the activity may not
// even exist at tap time, so the target has to survive a cold start.
//
// Deliberately free of react-native imports so it runs under the project's
// node-only Jest config (see jest.config.js).
// ----------------------------------------------------------------

/** Mirrors the BubbleState enum in android/.../bubble/BubbleState.java. */
export type BubbleLaunchTarget =
  | "UNKNOWN"
  | "AVAILABLE"
  | "REQUESTED"
  | "ACCEPTED"
  | "ARRIVING"
  | "TRIP_STARTED";

export type BubbleRoute = {
  /** A route name registered in the navigators, passed to `navigate()`. */
  route: string;
  /**
   * Whether to re-open the active-trip bottom sheet after navigating.
   *
   * The in-progress trip UI is a sheet over the map, not a screen, and it is
   * reopened by the existing "onReopenRideSheet" DeviceEventEmitter event — the
   * same one the "Return to Ride" pill in the tab bar fires.
   */
  reopenRideSheet: boolean;
};

const MAP: BubbleRoute = { route: "Map", reopenRideSheet: false };
const ACTIVE_TRIP: BubbleRoute = { route: "Map", reopenRideSheet: true };

/**
 * Resolve a stored launch target into a navigation instruction.
 *
 * Returns `null` for anything that is not a recognised target, including the
 * empty slot. That is the common case — the driver opened the app from the
 * launcher or a notification — and it must leave navigation alone rather than
 * yanking them to the map.
 */
export function routeForBubbleTarget(
  target: string | null | undefined,
): BubbleRoute | null {
  switch (target) {
    // No active ride: the driver wants the main screen — status, availability,
    // nearby requests.
    case "AVAILABLE":
    // Nothing useful to route to when state could not be confirmed; the app
    // itself is the recovery, and it re-syncs on resume.
    case "UNKNOWN":
      return MAP;

    // The offer modal is not a route. It is mounted above the navigator and
    // auto-opens once `drainPendingRideRequest` puts the pending offer into
    // state, which already runs on resume — so landing on the map is enough.
    case "REQUESTED":
      return MAP;

    case "ACCEPTED":
    case "ARRIVING":
    case "TRIP_STARTED":
      return ACTIVE_TRIP;

    default:
      return null;
  }
}
