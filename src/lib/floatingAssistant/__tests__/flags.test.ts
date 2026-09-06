import { afterEach, describe, expect, it } from "@jest/globals";

import {
  __setFloatingAssistantOverride,
  isFloatingAssistantEnabled,
} from "../flags";

afterEach(() => {
  __setFloatingAssistantOverride(null);
});

describe("isFloatingAssistantEnabled", () => {
  // The bubble is a system overlay drawn over other apps. If we cannot
  // positively confirm the flag is on, the only safe answer is "no bubble" —
  // a production overlay bug with no kill switch needs a store release to
  // recover. Under Jest there is no Firebase and no __DEV__, which is exactly
  // the "cannot confirm" case.
  it("fails closed when remote config is unavailable", () => {
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
