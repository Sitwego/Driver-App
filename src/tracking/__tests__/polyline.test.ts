import { describe, expect, it } from "@jest/globals";

import { decodePolyline, encodePolyline } from "../polyline";
import { U_ROUTE_ENCODED, U_ROUTE_POINTS } from "../testing/fixtures";

describe("polyline codec", () => {
  it("decodes Google's documented example polyline", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const path = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(path).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it("encodes Google's documented example coordinates", () => {
    const encoded = encodePolyline([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
    expect(encoded).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("round-trips the U-route fixture losslessly (grid-aligned coords)", () => {
    expect(decodePolyline(U_ROUTE_ENCODED)).toEqual(U_ROUTE_POINTS);
  });

  it("handles negative deltas and tiny movements", () => {
    const path = [
      { latitude: -1.30001, longitude: 36.80001 },
      { latitude: -1.30002, longitude: 36.8 },
      { latitude: -1.3, longitude: 36.80005 },
    ];
    expect(decodePolyline(encodePolyline(path))).toEqual(path);
  });
});
