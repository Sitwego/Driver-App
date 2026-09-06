import { describe, expect, it } from "@jest/globals";

import { isExpiredTokenResponse } from "../isSessionExpired";

function err(status: number, headers?: Record<string, unknown>) {
  return { response: { status, headers } };
}

describe("isExpiredTokenResponse", () => {
  it("recognises the backend's expiry signal", () => {
    expect(isExpiredTokenResponse(err(401, { "x-expired-token": "true" }))).toBe(
      true,
    );
  });

  /**
   * The case that decides whether this is safe to act on. Business-logic 401s
   * exist (the 2FA endpoints refuse a bad API key with one), and signing a
   * driver out over an authorisation error on a single screen would be far
   * worse than the problem being solved.
   */
  it("ignores a 401 that is not an expiry", () => {
    expect(isExpiredTokenResponse(err(401))).toBe(false);
    expect(isExpiredTokenResponse(err(401, {}))).toBe(false);
    expect(isExpiredTokenResponse(err(401, { "x-expired-token": "false" }))).toBe(
      false,
    );
  });

  it("ignores the header on any other status", () => {
    expect(isExpiredTokenResponse(err(403, { "x-expired-token": "true" }))).toBe(
      false,
    );
    expect(isExpiredTokenResponse(err(500, { "x-expired-token": "true" }))).toBe(
      false,
    );
  });

  it("survives shapes that are not axios errors at all", () => {
    expect(isExpiredTokenResponse(undefined)).toBe(false);
    expect(isExpiredTokenResponse(null)).toBe(false);
    expect(isExpiredTokenResponse(new Error("network down"))).toBe(false);
    expect(isExpiredTokenResponse({ response: undefined })).toBe(false);
    expect(isExpiredTokenResponse(err(401, { "x-expired-token": true }))).toBe(
      false,
    );
  });

  it("does not care how the header is cased", () => {
    expect(isExpiredTokenResponse(err(401, { "x-expired-token": "TRUE" }))).toBe(
      true,
    );
  });
});
