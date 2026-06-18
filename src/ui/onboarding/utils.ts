import { ControlsContextType, isTwoOrThreeWheeler } from "./state";

export function isControlsContextEmpty(state: ControlsContextType): boolean {
  const { vehicleDetails, docs } = state;

  // Doc fields that don't gate submission for the selected vehicle type:
  // KRA is always optional; boda/tuk-tuk skip the PSV badge & inspection
  // sticker. Insurance is required for every vehicle type.
  const skippedDocKeys = new Set<string>(["kraPin"]);
  if (isTwoOrThreeWheeler(vehicleDetails.vehicle_type)) {
    skippedDocKeys.add("psvBadge");
    skippedDocKeys.add("psvBadgeExpiry");
    skippedDocKeys.add("inspection");
    skippedDocKeys.add("inspectionExpiry");
  }

  const fields = [
    ...Object.entries(vehicleDetails).filter(([key]) => key !== "vin"),
    ...Object.entries(docs).filter(([key]) => !skippedDocKeys.has(key)),
  ];

  return fields.some(([_, value]) => {
    if (value == null) return true;

    if (typeof value === "object" && "id" in value && "nonce" in value) {
      return !value.id.trim() || value.nonce.length === 0;
    }

    if (typeof value === "string") return !value.trim();

    return false;
  });
}
