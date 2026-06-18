import type { SubscriptionCategory } from "~/navigation/types";

/** Vehicle segment of a plan id → subscription category. */
const PLAN_VEHICLE_TO_CATEGORY: Record<string, SubscriptionCategory> = {
  bike: "Bike",
  taxi: "Taxi",
  tuk_tuk: "TukTuk",
};

export function getCategoryFromPlanId(planId: string): SubscriptionCategory {
  const match = planId.toLowerCase().match(/^plan_(tuk_tuk|bike|taxi)/);
  return match ? PLAN_VEHICLE_TO_CATEGORY[match[1]] : "Taxi";
}
