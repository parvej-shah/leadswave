export type SubscriptionTier = "free" | "light" | "pro";

const TIER_WEIGHTS: Record<SubscriptionTier, number> = {
  free: 0,
  light: 1,
  pro: 2,
};

export function isTierAtLeast(
  currentTier: string | null | undefined,
  requiredTier: SubscriptionTier,
): boolean {
  const current = (currentTier as SubscriptionTier) ?? "free";
  const currentWeight = TIER_WEIGHTS[current] ?? 0;
  const requiredWeight = TIER_WEIGHTS[requiredTier];
  return currentWeight >= requiredWeight;
}

export function assertTier(
  org: { subscriptionTier?: string | null },
  requiredTier: SubscriptionTier,
) {
  if (!isTierAtLeast(org.subscriptionTier, requiredTier)) {
    const error = new Error(`Subscription tier '${requiredTier}' or higher is required.`);
    (error as Error & { statusCode?: number }).statusCode = 402;
    throw error;
  }
}
