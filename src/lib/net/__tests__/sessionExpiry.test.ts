import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  hasFiredSessionExpiry,
  notifySessionExpired,
  resetSessionExpiry,
  setSessionExpiredHandler,
} from "../sessionExpiry";

beforeEach(() => {
  setSessionExpiredHandler(undefined);
  resetSessionExpiry();
});

describe("session expiry", () => {
  it("calls the registered handler", () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);

    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  /**
   * The reason this module exists. A token dies between requests, so every
   * screen polling in the background 401s at the same moment — without the
   * guard, one expiry runs the whole logout (five stores, the query cache,
   * Firebase) once per in-flight request.
   */
  it("fires once however many requests fail together", () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);

    notifySessionExpired();
    notifySessionExpired();
    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(hasFiredSessionExpiry()).toBe(true);
  });

  /**
   * Without re-arming, a driver could only ever be auto-logged-out once per app
   * launch — the second expiry would be swallowed silently.
   */
  it("re-arms on login so the next expiry is reported", () => {
    const handler = jest.fn();
    setSessionExpiredHandler(handler);

    notifySessionExpired();
    resetSessionExpiry();
    notifySessionExpired();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  /** The provider unmounts on logout; a late 401 must not crash. */
  it("is silent when nothing is registered", () => {
    expect(() => notifySessionExpired()).not.toThrow();
  });
});
