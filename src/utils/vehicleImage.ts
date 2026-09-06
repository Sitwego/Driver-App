import type { SubscriptionCategory } from "~/navigation/types";

/**
 * Hero artwork per vehicle category.
 *
 * Taxi keeps the three-quarter car render, which reads well large. Bike and
 * TukTuk reuse the map marker's top-view assets — they are the only per-type
 * art that exists, and they are legible at hero size.
 *
 * These deliberately live here rather than in `MapCarIcon`, whose module pulls
 * in `react-native-maps`; a plain screen should not drag the map runtime in
 * just to pick an image.
 */
const VEHICLE_HERO_IMAGES: Record<SubscriptionCategory, number> = {
  Taxi: require("../../assets/images/ny_ic_car.png"),
  Bike: require("../../assets/images/ny_ic_bike_top_view.png"),
  TukTuk: require("../../assets/images/ny_ic_auto_top_view.png"),
};

/**
 * Map a free-text vehicle type onto a category, or null when unrecognised.
 *
 * Two vocabularies reach this app for the same three vehicles: onboarding
 * writes `vehicle_type` as "Bike" / "Auto" / "Taxi", while subscriptions use
 * `SubscriptionCategory` ("Bike" / "TukTuk" / "Taxi"). Drivers also say "boda"
 * for a motorcycle. Everything is folded to one category here so callers do
 * not each grow their own spelling table.
 *
 * Returning null rather than defaulting to Taxi is the point: an unknown value
 * lets the caller fall back to a source it trusts instead of silently showing
 * a car to a motorcycle rider.
 */
export function normalizeVehicleCategory(
  value: string | null | undefined,
): SubscriptionCategory | null {
  if (!value) return null;

  switch (value.toLowerCase().replace(/[\s_-]/g, "")) {
    case "bike":
    case "boda":
    case "bodaboda":
    case "motorbike":
    case "motorcycle":
      return "Bike";
    case "auto":
    case "tuktuk":
    case "autorickshaw":
    case "rickshaw":
      return "TukTuk";
    case "taxi":
    case "car":
      return "Taxi";
    default:
      return null;
  }
}

/** Hero image for a vehicle category. */
export function getVehicleHeroImage(category: SubscriptionCategory): number {
  return VEHICLE_HERO_IMAGES[category] ?? VEHICLE_HERO_IMAGES.Taxi;
}
