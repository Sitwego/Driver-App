import { describe, expect, it } from "@jest/globals";

import { routeForBubbleTarget } from "../bubbleLaunch";

describe("routeForBubbleTarget", () => {
  // The overwhelmingly common resume is the driver opening the app from the
  // launcher or a notification. The slot is empty then, and routing on an empty
  // slot would yank them to the map from whatever screen they meant to open.
  it("returns null when the slot is empty", () => {
    expect(routeForBubbleTarget(null)).toBeNull();
    expect(routeForBubbleTarget(undefined)).toBeNull();
    expect(routeForBubbleTarget("")).toBeNull();
  });

  // A value we do not recognise means the native enum moved without this map
  // moving with it. Doing nothing is recoverable; guessing a screen is not.
  it("returns null for an unrecognised target", () => {
    expect(routeForBubbleTarget("SOMETHING_NEW")).toBeNull();
  });

  it("sends idle and unconfirmed states to the main driver screen", () => {
    expect(routeForBubbleTarget("AVAILABLE")).toEqual({
      route: "Map",
      reopenRideSheet: false,
    });
    expect(routeForBubbleTarget("UNKNOWN")).toEqual({
      route: "Map",
      reopenRideSheet: false,
    });
  });

  // The offer modal is mounted above the navigator, not registered as a route,
  // and opens itself once the pending offer reaches state. Asking for the sheet
  // here would fight that.
  it("sends a pending offer to the map without reopening the trip sheet", () => {
    expect(routeForBubbleTarget("REQUESTED")).toEqual({
      route: "Map",
      reopenRideSheet: false,
    });
  });

  // The active-trip UI is a sheet over the map. Navigating alone would drop the
  // driver on a bare map with no passenger, route or fare in reach.
  it.each(["ACCEPTED", "ARRIVING", "TRIP_STARTED"])(
    "reopens the trip sheet for %s",
    (target) => {
      expect(routeForBubbleTarget(target)).toEqual({
        route: "Map",
        reopenRideSheet: true,
      });
    },
  );
});
