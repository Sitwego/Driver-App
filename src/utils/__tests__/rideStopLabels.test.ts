import { describe, expect, it } from "@jest/globals";

import { deriveStopLabels } from "../rideStopLabels";

describe("deriveStopLabels", () => {
  it("falls back rather than rendering nothing when every field is null", () => {
    const labels = deriveStopLabels(
      {
        building: null,
        street: null,
        ward: null,
        city: null,
        road: null,
        country: null,
      },
      "Pickup",
    );
    expect(labels).toEqual({ primary: "Pickup", secondary: "" });
  });

  it("falls back for a null or undefined location", () => {
    expect(deriveStopLabels(null, "Destination").primary).toBe("Destination");
    expect(deriveStopLabels(undefined, "Destination").primary).toBe(
      "Destination",
    );
  });

  it("prefers building as the headline and keeps the rest as the address", () => {
    const labels = deriveStopLabels(
      {
        building: "Marina Bay Financial Centre - Tower 1",
        street: "8 Marina Boulevard",
        city: "Singapore",
      },
      "Destination",
    );
    expect(labels.primary).toBe("Marina Bay Financial Centre - Tower 1");
    expect(labels.secondary).toBe("8 Marina Boulevard, Singapore");
  });

  it("does not repeat the headline inside the address line", () => {
    const labels = deriveStopLabels(
      { street: "168 Bedok South Ave 3", city: "Singapore" },
      "Pickup",
    );
    expect(labels.primary).toBe("168 Bedok South Ave 3");
    expect(labels.secondary).toBe("Singapore");
  });

  it("de-dupes case-insensitively and ignores surrounding whitespace", () => {
    const labels = deriveStopLabels(
      { street: " Kilimani ", ward: "KILIMANI", city: "Nairobi" },
      "Pickup",
    );
    expect(labels.primary).toBe("Kilimani");
    expect(labels.secondary).toBe("Nairobi");
  });

  it("de-dupes repeated parts within the address line", () => {
    const labels = deriveStopLabels(
      { building: "Westgate Mall", ward: "Westlands", city: "Westlands" },
      "Destination",
    );
    expect(labels.secondary).toBe("Westlands");
  });

  it("promotes city to the headline when it is the only field populated", () => {
    const labels = deriveStopLabels({ city: "Nairobi" }, "Pickup");
    expect(labels).toEqual({ primary: "Nairobi", secondary: "" });
  });

  it("treats blank strings as absent", () => {
    const labels = deriveStopLabels(
      { building: "   ", street: "Ngong Road", city: "Nairobi" },
      "Pickup",
    );
    expect(labels.primary).toBe("Ngong Road");
    expect(labels.secondary).toBe("Nairobi");
  });
});
