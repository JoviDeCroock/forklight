// Stable scenario → colour assignment shared by charts, tree, and panels.
// The order is tuned for mutual distinguishability on the ink background: each
// step jumps hue far enough that two adjacent forecast lines never read as the
// same series in a small multiple.
export const SCENARIO_COLORS = ["#38bdf8", "#c084fc", "#34d399", "#fb7185", "#fbbf24", "#f472b6"];

export function scenarioColor(forkIds: string[], scenarioId: string): string {
  const index = forkIds.indexOf(scenarioId);
  return SCENARIO_COLORS[(index < 0 ? 0 : index) % SCENARIO_COLORS.length];
}

/** Same hue at low alpha — for focus rings, glows, and tinted fills. */
export function scenarioTint(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
