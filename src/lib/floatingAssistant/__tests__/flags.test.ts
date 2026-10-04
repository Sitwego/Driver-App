import { afterEach, describe, expect, it } from "@jest/globals";

import {
  FLOATING_ASSISTANT_DEFAULT,
  FLOATING_ASSISTANT_FLAG_KEY,
  __setFloatingAssistantOverride,
  isFloatingAssistantEnabled,
} from "../flags";

afterEach(() => {
  __setFloatingAssistantOverride(null);
});

// The provider registers this exact key with Remote Config, and someone has to
// type the same string into the Firebase console. If the two ever drift the
// feature silently never turns on, which is precisely the failure that made the
// bubble invisible in production the first time.
describe("remote config contract", () => {
  it("exposes the key the Firebase console must define", () => {
    expect(FLOATING_ASSISTANT_FLAG_KEY).toBe("FLOATING_ASSISTANT_ENABLED");
  });

  // Governs devices that have never completed a fetch. Kept ON so a Firebase
  // outage cannot permanently hide the feature; killing it in the field is done
  // by publishing `false`, which does not depend on this value.
  it("defaults to on when no fetch has succeeded", () => {
    expect(FLOATING_ASSISTANT_DEFAULT).toBe(true);
  });
});

describe("isFloatingAssistantEnabled", () => {
  // Distinct from the default above: this is the case where the Remote Config
  // module itself is unusable — a broken build, or Jest. Nothing can be
  // trusted, so it fails closed regardless of the registered default.
  it("fails closed when the remote config module is unavailable", () => {
    expect(isFloatingAssistantEnabled()).toBe(false);
  });

  it("honours the override when set to true", () => {
    __setFloatingAssistantOverride(true);
    expect(isFloatingAssistantEnabled()).toBe(true);
  });

  // false must be distinguishable from "unset", so the override has to win
  // over every other source rather than falling through to the flag lookup.
  it("honours an override of false", () => {
    __setFloatingAssistantOverride(false);
    expect(isFloatingAssistantEnabled()).toBe(false);
  });

  it("falls back to the flag lookup once the override is cleared", () => {
    __setFloatingAssistantOverride(true);
    __setFloatingAssistantOverride(null);
    expect(isFloatingAssistantEnabled()).toBe(false);
  });
});
