/**
 * The two contracts the backend relies on, pinned here because both are
 * failure-shaped: they are invisible when they work, and show up only as a
 * silently wrong dataset — or a driver who cannot log in — when they break.
 *
 * Unlike the other suites in this project, the module under test does import
 * `react-native` and `expo-application`. Both are mocked, so this still runs in
 * plain Node with no bundler involved.
 *
 * The `mock` prefixes are load-bearing: jest hoists `jest.mock` calls above the
 * imports and rejects factories that close over anything not named that way.
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockGetAndroidId = jest.fn<() => string>();
let mockPlatformOS = "android";

jest.mock("react-native", () => ({
  // `OS` is a getter rather than a value so a test can change the platform
  // without reloading the module under test — `Platform` itself is captured
  // once, at import.
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock("expo-application", () => ({
  getAndroidId: () => mockGetAndroidId(),
}));

import { getDeviceId } from "../deviceId";

beforeEach(() => {
  mockGetAndroidId.mockReset();
  mockPlatformOS = "android";
});

describe("getDeviceId", () => {
  it("returns the SSAID on Android", () => {
    mockGetAndroidId.mockReturnValue("dd96dec43fb81c97");
    expect(getDeviceId()).toBe("dd96dec43fb81c97");
  });

  /**
   * `getAndroidId()` throws on iOS, and the value iOS would give is unrelated
   * to device identity. It must never be called, let alone sent.
   */
  it("never touches the native module on iOS", () => {
    mockPlatformOS = "ios";
    expect(getDeviceId()).toBeUndefined();
    expect(mockGetAndroidId).not.toHaveBeenCalled();
  });

  /**
   * A driver must be able to log in and work when this is unavailable, so every
   * failure path is silent and simply omits the field.
   */
  it("is silent when the platform throws", () => {
    mockGetAndroidId.mockImplementation(() => {
      throw new Error("UnavailabilityError");
    });
    expect(getDeviceId()).toBeUndefined();
  });

  /**
   * Android can return an empty string. Sent as-is it would become one shared
   * hash across every device that did so — which is exactly what the old
   * hardcoded "some-device-id" placeholder produced for the entire fleet.
   */
  it("treats an empty id as no id", () => {
    mockGetAndroidId.mockReturnValue("");
    expect(getDeviceId()).toBeUndefined();
  });
});
