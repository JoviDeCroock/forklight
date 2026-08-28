import type { CanvasData, ChartData } from "../server/canvas.ts";
import { scenarioColor } from "./colors.ts";

const W = 320;
const H = 84;
const PAD = { top: 8, right: 6, bottom: 14, left: 6 };
const INCIDENT_MINUTE = 35;

function toPath(
  points: { minute: number; value: number }[],
  xOf: (minute: number) => number,
  yOf: (value: number) => number,
): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.minute).toFixed(1)},${yOf(p.value).toFixed(1)}`)
    .join(" ");
}

function Chart({ chart, forkIds, clockMinute }: { chart: ChartData; forkIds: string[]; clockMinute: number }) {
  const allPoints = [...chart.observed, ...chart.forecasts.flatMap((f) => f.points)];
  const minutes = allPoints.map((p) => p.minute);
  const values = allPoints.map((p) => p.value);
  const x0 = Math.min(...minutes);
  const x1 = Math.max(...minutes, clockMinute + 1);
  let v0 = Math.min(...values);
  let v1 = Math.max(...values);
  const pad = Math.max((v1 - v0) * 0.12, 0.5);
  v0 = Math.max(0, v0 - pad);
  v1 = v1 + pad;
  const xOf = (minute: number) => PAD.left + ((minute - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const yOf = (value: number) => PAD.top + (1 - (value - v0) / (v1 - v0)) * (H - PAD.top - PAD.bottom);
  const degraded =
    chart.id === "cache_hit_ratio" || chart.id === "requests_per_min"
      ? chart.now < chart.preIncident * 0.8
      : chart.now > chart.preIncident * 1.5;

  return (
    <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3" data-testid={`chart-${chart.id}`}>
      <div class="mb-1 flex items-baseline justify-between gap-2">
        <span class="truncate text-xs font-medium text-zinc-400">{chart.label}</span>
        <span class={`font-mono text-sm ${degraded ? "text-rose-400" : "text-emerald-300"}`}>
          {chart.now}
          <span class="ml-0.5 text-[10px] text-zinc-500">{chart.unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} class="block w-full" role="img" aria-label={chart.label}>
        {/* pre-incident reference */}
        <line
          x1={PAD.left} x2={W - PAD.right}
          y1={yOf(chart.preIncident)} y2={yOf(chart.preIncident)}
          stroke="#3f3f46" stroke-width="0.6" stroke-dasharray="1 3"
        />
        {/* bad deploy marker */}
        {INCIDENT_MINUTE >= x0 && (
          <line
            x1={xOf(INCIDENT_MINUTE)} x2={xOf(INCIDENT_MINUTE)}
            y1={PAD.top} y2={H - PAD.bottom}
            stroke="#f59e0b" stroke-width="0.7" stroke-opacity="0.55"
          />
        )}
        {/* now divider — forecasts live to the right */}
        <line
          x1={xOf(clockMinute)} x2={xOf(clockMinute)}
          y1={PAD.top} y2={H - PAD.bottom}
          stroke="#52525b" stroke-width="0.7" stroke-dasharray="3 2"
        />
        <path d={toPath(chart.observed, xOf, yOf)} fill="none" stroke="#d4d4d8" stroke-width="1.4" />
        {chart.forecasts.map((f) => (
          <path
            key={f.scenarioId}
            d={toPath(f.points, xOf, yOf)}
            fill="none"
            stroke={scenarioColor(forkIds, f.scenarioId)}
            stroke-width="1.3"
            stroke-dasharray="4 3"
            data-testid={`forecast-${chart.id}-${f.scenarioId}`}
          />
        ))}
        <text x={PAD.left} y={H - 3} class="fill-zinc-600" font-size="7">
          {chart.observed[0]?.clock}
        </text>
        <text x={xOf(INCIDENT_MINUTE) + 2} y={PAD.top + 6} fill="#f59e0b" fill-opacity="0.8" font-size="7">
          deploy 14:05
        </text>
        <text x={xOf(clockMinute) + 2} y={H - 3} class="fill-zinc-600" font-size="7">
          now
        </text>
      </svg>
    </div>
  );
}

export function MetricCharts({ data }: { data: CanvasData }) {
  const forkIds = data.scenarios.filter((s) => s.id !== "main").map((s) => s.id);
  const forecasting = data.scenarios.filter((s) => s.id !== "main" && s.actions.length > 0);
  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="signals">
      <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 class="text-sm font-semibold text-zinc-300">Signals</h2>
        <div class="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
          <span class="flex items-center gap-1">
            <span class="inline-block h-px w-4 bg-zinc-300" /> observed
          </span>
          {forecasting.map((s) => (
            <span key={s.id} class="flex items-center gap-1">
              <span
                class="inline-block h-px w-4 border-t border-dashed"
                style={{ borderColor: scenarioColor(forkIds, s.id) }}
              />
              {s.name}
            </span>
          ))}
        </div>
        <div class="ml-auto flex items-center gap-2 text-[11px] text-zinc-500">
          {data.deploys.map((d) => (
            <span key={d.id} class="font-mono">
              {d.atClock} {d.service}@{d.version.replace("v", "")}
            </span>
          ))}
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.charts.map((chart) => (
          <Chart key={chart.id} chart={chart} forkIds={forkIds} clockMinute={data.clockMinute} />
        ))}
        <div class="flex flex-col justify-center gap-1 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3 text-xs text-zinc-500">
          {data.alerts.map((a) => (
            <div key={a.id} class="flex items-start gap-2">
              <span
                class={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${a.severity === "page" ? "bg-rose-400" : "bg-amber-300"}`}
              />
              <span>
                <span class="font-mono text-zinc-400">{a.atClock}</span> {a.summary}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
