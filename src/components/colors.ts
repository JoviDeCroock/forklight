// Stable scenario → colour assignment shared by charts, tree, and panels.
export const SCENARIO_COLORS = ["#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#fbbf24", "#f472b6"];

export function scenarioColor(forkIds: string[], scenarioId: string): string {
  const index = forkIds.indexOf(scenarioId);
  return SCENARIO_COLORS[(index < 0 ? 0 : index) % SCENARIO_COLORS.length];
}
