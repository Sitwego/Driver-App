import { ControlsContextType } from "./state";

export function isControlsContextEmpty(state: ControlsContextType): boolean {
  const { vehicleDetails, docs } = state;

  const fields = [
    ...Object.entries(vehicleDetails).filter(([key]) => key !== "vin"),
    ...Object.entries(docs),
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
