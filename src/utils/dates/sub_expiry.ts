interface SubscriptionData {
  last_billed_at: string;
  plan_end_date: string;
}

export function isPaymentDue(subscription: SubscriptionData): boolean {
  const now = new Date();
  const lastBilled = new Date(subscription.last_billed_at || now);
  const planEndDate = new Date(subscription.plan_end_date);
  const msPerDay = 24 * 60 * 60 * 1000;

  // days since last billing
  const daysSinceLastBilled = Math.floor(
    (now.getTime() - lastBilled.getTime()) / msPerDay,
  );

  console.log("daysSinceLastBilled", daysSinceLastBilled);

  // days until expiration
  const daysUntilExpiration = Math.ceil(
    (planEndDate.getTime() - now.getTime()) / msPerDay,
  );

  console.log("daysUntilExpiration", daysUntilExpiration);

  // 1. Plan is within 0 days of expiration, or
  // 2. 7 days have passed since last billing (for weekly billing cycle)
  return daysUntilExpiration <= 1 || daysSinceLastBilled >= 7;
}
