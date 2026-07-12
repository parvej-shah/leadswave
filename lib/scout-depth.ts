/**
 * Scouting-depth presets: friendly knob over the raw Places API budgets.
 * Deeper = more API spend, more coverage. Safety constants (geocode distance
 * guard, crawl page caps) stay in code and are NOT affected by depth.
 */
export type ScoutDepth = "light" | "normal" | "deep";

const DEPTH_BUDGETS: Record<ScoutDepth, { maxPerArea: number; maxPerCity: number }> = {
  light: { maxPerArea: 50, maxPerCity: 150 },
  normal: { maxPerArea: 100, maxPerCity: 300 }, // current defaults
  deep: { maxPerArea: 100, maxPerCity: 500 }, // 100 = Places pagination ceiling per query
};

export function scoutBudgets(depth: string | null | undefined) {
  return DEPTH_BUDGETS[(depth as ScoutDepth) ?? "normal"] ?? DEPTH_BUDGETS.normal;
}
