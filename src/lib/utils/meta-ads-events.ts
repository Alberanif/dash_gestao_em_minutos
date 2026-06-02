type MetaAction = { action_type: string; value: string };

/**
 * Extracts total purchases from a Meta Ads actions array.
 *
 * Uses only "offsite_conversion.fb_pixel_purchase" (Meta's deduplicated CAPI metric).
 * Summing both "purchase" + "offsite_conversion.fb_pixel_purchase" double-counts
 * because they represent the same purchase event via different tracking channels.
 */
export function extractPurchases(
  actions: MetaAction[] | undefined | null
): number {
  if (!actions || actions.length === 0) return 0;
  const sum = actions
    .filter((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")
    .reduce((acc, a) => acc + (parseFloat(a.value) || 0), 0);
  return Math.round(sum);
}

/**
 * Extracts total checkout initiations from a Meta Ads actions array.
 *
 * Counts "initiate_checkout" events — people who reached the checkout page.
 * Used as a funnel-top indicator alongside purchases for paid launch campaigns.
 */
export function extractCheckout(
  actions: MetaAction[] | undefined | null
): number {
  if (!actions || actions.length === 0) return 0;
  const sum = actions
    .filter((a) => a.action_type === "initiate_checkout")
    .reduce((acc, a) => acc + (parseFloat(a.value) || 0), 0);
  return Math.round(sum);
}
