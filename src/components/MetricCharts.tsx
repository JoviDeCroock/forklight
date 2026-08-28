import type { CanvasData, ChartData } from "../server/canvas.ts";
import { scenarioColor } from "./colors.ts";

const INCIDENT_MINUTE = 35;
const HORIZON = 95; // 15:05 — the far edge of the forecast window
const FORECAST_SPAN = 25; // minutes of forecast the loader projects past "now"

// Two chart sizes, both authored near 1:1 with their rendered width so stroke
// weights read identically in the hero and in the small multiples.
const HERO = { w: 1120, h: 150, top: 16, right: 16, bottom: 22, left: 44 };
const MINI = { w: 300, h: 56, top: 7, right: 8, bottom: 9, left: 8 };

const OBSERVED = "#cbd5e1";

interface Scale {
  xOf: (minute: number) => number;
  yOf: (value: number) => number;
  x0: number;
  x1: number;
  v0: number;
  v1: number;
}

function makeScale(chart: ChartData, clockMinute: number, box: typeof HERO): Scale {
  const allPoints = [...chart.observed, ...chart.forecasts.flatMap((f) => f.points)];
  const minutes = allPoints.map((p) => p.minute);
  const values = allPoints.map((p) => p.value);
  const x0 = Math.min(...minutes);
  // Always reserve the full forecast window, whether or not anything has been
  // rehearsed yet — the axis must not jump when the first fork lands.
  const x1 = Math.max(...minutes, Math.min(HORIZON, clockMinute + FORECAST_SPAN));
  let v0 = Math.min(...values, chart.preIncident);
  let v1 = Math.max(...values, chart.preIncident);
  const pad = Math.max((v1 - v0) * 0.14, 0.5);
  v0 = Math.max(0, v0 - pad);
  v1 = v1 + pad;
  return {
    x0,
    x1,
    v0,
    v1,
    xOf: (minute) => box.left + ((minute - x0) / (x1 - x0)) * (box.w - box.left - box.right),
    yOf: (value) => box.top + (1 - (value - v0) / (v1 - v0)) * (box.h - box.top - box.bottom),
  };
}

function toPath(points: { minute: number; value: number }[], s: Scale): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${s.xOf(p.minute).toFixed(1)},${s.yOf(p.value).toFixed(1)}`)
    .join(" ");
}

function formatValue(value: number, unit: string): string {
  if (unit === "ms") return Math.round(value).toLocaleString("en-US");
  if (unit === "/min") return String(Math.round(value));
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1);
}

/** Round gridline values (1 / 2 / 5 × 10ⁿ) inside the visible range. */
function niceTicks(v0: number, v1: number, count = 3): number[] {
  const raw = (v1 - v0) / count;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-6)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const ticks: number[] = [];
  for (let t = Math.ceil(v0 / step) * step; t <= v1 + step * 0.001; t += step) ticks.push(t);
  return ticks;
}

function isDegraded(chart: ChartData): boolean {
  // The error rate is judged against its SLO, not its baseline: after a
  // recovery it sits above 0.4% but well under 1%, and painting that red
  // would contradict the incident status the reader just saw.
  if (chart.id === "checkout_error_rate") return chart.now >= 1;
  return chart.id === "cache_hit_ratio" || chart.id === "orders_per_min"
    ? chart.now < chart.preIncident * 0.8
    : chart.now > chart.preIncident * 1.5;
}

/** Shared marks: the pre-incident reference, the deploy that broke it, and the
 *  divider where observation stops and forecast begins. */
function Marks({
  chart,
  s,
  box,
  clockMinute,
  labelled,
}: {
  chart: ChartData;
  s: Scale;
  box: typeof HERO;
  clockMinute: number;
  labelled: boolean;
}) {
  const top = box.top;
  const bottom = box.h - box.bottom;
  return (
    <>
      {/* forecast half of the plot sits on a faintly lifted ground */}
      <rect
        x={s.xOf(clockMinute)}
        y={top}
        width={Math.max(0, box.w - box.right - s.xOf(clockMinute))}
        height={bottom - top}
        fill="#9dabc0"
        fill-opacity="0.035"
      />
      <line
        x1={box.left}
        x2={box.w - box.right}
        y1={s.yOf(chart.preIncident)}
        y2={s.yOf(chart.preIncident)}
        stroke="#4d5a70"
        stroke-width="1"
        stroke-dasharray="2 4"
      />
      {INCIDENT_MINUTE >= s.x0 && (
        <>
          <line
            x1={s.xOf(INCIDENT_MINUTE)}
            x2={s.xOf(INCIDENT_MINUTE)}
            y1={top}
            y2={bottom}
            stroke="#f59e0b"
            stroke-width="1"
            stroke-opacity="0.5"
          />
          <path
            d={`M${s.xOf(INCIDENT_MINUTE) - 3.5},${top} L${s.xOf(INCIDENT_MINUTE) + 3.5},${top} L${s.xOf(INCIDENT_MINUTE)},${top + 4.5} Z`}
            fill="#f59e0b"
            fill-opacity="0.85"
          />
        </>
      )}
      <line
        x1={s.xOf(clockMinute)}
        x2={s.xOf(clockMinute)}
        y1={top}
        y2={bottom}
        stroke="#78869d"
        stroke-width="1"
        stroke-dasharray="3 3"
      />
      {labelled && (
        <>
          <text
            x={s.xOf(INCIDENT_MINUTE) + 6}
            y={top + 9}
            fill="#f59e0b"
            fill-opacity="0.9"
            font-size="10"
            font-family="var(--font-mono)"
          >
            14:05 deploy v8.3.1
          </text>
          <text
            x={s.xOf(clockMinute) - 6}
            y={top + 9}
            text-anchor="end"
            fill="#9dabc0"
            font-size="10"
            font-family="var(--font-mono)"
          >
            now
          </text>
          <text
            x={(s.xOf(clockMinute) + box.w - box.right) / 2}
            y={top + 9}
            text-anchor="middle"
            fill="#8794a8"
            font-size="9"
            letter-spacing="1.4"
            font-family="var(--font-mono)"
          >
            FORECAST
          </text>
        </>
      )}
    </>
  );
}

function HeroChart({
  chart,
  forkIds,
  clockMinute,
}: {
  chart: ChartData;
  forkIds: string[];
  clockMinute: number;
}) {
  const box = HERO;
  const s = makeScale(chart, clockMinute, box);
  const degraded = isDegraded(chart);
  const fillId = `fl-fill-${chart.id}`;
  const ticks = niceTicks(s.v0, s.v1);
  const sloVisible = chart.id === "checkout_error_rate" && 1 >= s.v0 && 1 <= s.v1;

  return (
    <div
      class="fl-panel relative overflow-hidden rounded-xl border border-ink-800 bg-ink-900/70 p-3.5"
      data-testid={`chart-${chart.id}`}
    >
      <div class="mb-1.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div class="flex items-baseline gap-2.5">
          <span class="fl-eyebrow rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-1 text-rose-300">
            primary signal
          </span>
          <h3 class="font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-100">
            {chart.label}
          </h3>
          <span class="hidden font-mono text-[11px] text-ink-500 sm:inline">{chart.id}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span
            class={`fl-nums font-display text-[28px] leading-none font-semibold tracking-[-0.03em] ${
              degraded ? "text-rose-400" : "text-emerald-300"
            }`}
          >
            {formatValue(chart.now, chart.unit)}
          </span>
          <span class="text-sm text-ink-400">{chart.unit}</span>
          <span class="fl-nums ml-2 rounded-md border border-ink-750 bg-ink-850 px-2 py-[3px] font-mono text-[11px] text-ink-400">
            baseline {formatValue(chart.preIncident, chart.unit)}
            {chart.unit}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${box.w} ${box.h}`}
        class="block h-auto w-full"
        role="img"
        aria-label={`${chart.label}: ${formatValue(chart.now, chart.unit)}${chart.unit} now, baseline ${formatValue(chart.preIncident, chart.unit)}${chart.unit}`}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={OBSERVED} stop-opacity="0.16" />
            <stop offset="100%" stop-color={OBSERVED} stop-opacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={box.left}
              x2={box.w - box.right}
              y1={s.yOf(tick)}
              y2={s.yOf(tick)}
              stroke="#1d2431"
              stroke-width="1"
            />
            <text
              x={box.left - 8}
              y={s.yOf(tick) + 3}
              text-anchor="end"
              fill="#8794a8"
              font-size="10"
              font-family="var(--font-mono)"
            >
              {Number.isInteger(tick) ? tick : formatValue(tick, chart.unit)}
            </text>
          </g>
        ))}

        <Marks chart={chart} s={s} box={box} clockMinute={clockMinute} labelled />

        {sloVisible && (
          <>
            <line
              x1={box.left}
              x2={box.w - box.right}
              y1={s.yOf(1)}
              y2={s.yOf(1)}
              stroke="#34d399"
              stroke-width="1"
              stroke-opacity="0.45"
              stroke-dasharray="5 4"
            />
            <text
              x={box.left + 5}
              y={s.yOf(1) - 5}
              fill="#34d399"
              fill-opacity="0.85"
              font-size="10"
              font-family="var(--font-mono)"
            >
              SLO 1%
            </text>
          </>
        )}

        <path
          d={`${toPath(chart.observed, s)} L${s.xOf(chart.observed[chart.observed.length - 1]?.minute ?? 0).toFixed(1)},${(box.h - box.bottom).toFixed(1)} L${s.xOf(chart.observed[0]?.minute ?? 0).toFixed(1)},${(box.h - box.bottom).toFixed(1)} Z`}
          fill={`url(#${fillId})`}
        />
        <path
          d={toPath(chart.observed, s)}
          fill="none"
          stroke={OBSERVED}
          stroke-width="1.7"
          stroke-linejoin="round"
          stroke-linecap="round"
          class="fl-draw"
        />

        {chart.forecasts.map((f) => {
          const color = scenarioColor(forkIds, f.scenarioId);
          const last = f.points[f.points.length - 1];
          return (
            <g key={f.scenarioId}>
              <path
                d={toPath(f.points, s)}
                fill="none"
                stroke={color}
                stroke-width="1.7"
                stroke-dasharray="5 4"
                stroke-linejoin="round"
                stroke-linecap="round"
                data-testid={`forecast-${chart.id}-${f.scenarioId}`}
              />
              {last && (
                <circle cx={s.xOf(last.minute)} cy={s.yOf(last.value)} r="2.6" fill={color} />
              )}
            </g>
          );
        })}

        <text
          x={box.left}
          y={box.h - 7}
          fill="#8794a8"
          font-size="10"
          font-family="var(--font-mono)"
        >
          {chart.observed[0]?.clock}
        </text>
        <text
          x={box.w - box.right}
          y={box.h - 7}
          text-anchor="end"
          fill="#8794a8"
          font-size="10"
          font-family="var(--font-mono)"
        >
          15:05 horizon
        </text>
      </svg>

    </div>
  );
}

function Legend({
  forkIds,
  forecasting,
}: {
  forkIds: string[];
  forecasting: CanvasData["scenarios"];
}) {
  return (
    <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]">
      <span class="flex items-center gap-1.5 text-ink-300">
        <span class="inline-block h-[2px] w-5 rounded-full" style={{ background: OBSERVED }} />
        observed
      </span>
      {forecasting.map((scenario) => (
        <span key={scenario.id} class="flex items-center gap-1.5 text-ink-300">
          <span
            class="inline-block h-0 w-5 border-t-2 border-dashed"
            style={{ borderColor: scenarioColor(forkIds, scenario.id) }}
          />
          {scenario.name}
        </span>
      ))}
    </div>
  );
}

function MiniChart({
  chart,
  forkIds,
  clockMinute,
}: {
  chart: ChartData;
  forkIds: string[];
  clockMinute: number;
}) {
  const box = MINI;
  const s = makeScale(chart, clockMinute, box);
  const degraded = isDegraded(chart);

  return (
    <div
      class="fl-panel rounded-xl border border-ink-800/80 bg-ink-900/50 p-2.5 transition-colors hover:border-ink-700"
      data-testid={`chart-${chart.id}`}
    >
      <div class="mb-0.5 flex items-baseline justify-between gap-2">
        <span class="min-w-0 truncate text-[12px] font-medium text-ink-300">{chart.label}</span>
        <span class="flex shrink-0 items-baseline gap-1.5">
          <span class="fl-nums hidden font-mono text-[9.5px] text-ink-500 2xl:inline">
            was {formatValue(chart.preIncident, chart.unit)}
          </span>
          <span
            class={`fl-nums font-mono text-[13px] ${degraded ? "text-rose-400" : "text-emerald-300"}`}
          >
            {formatValue(chart.now, chart.unit)}
            <span class="ml-0.5 text-[10px] text-ink-500">{chart.unit}</span>
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${box.w} ${box.h}`}
        class="block h-auto w-full"
        role="img"
        aria-label={`${chart.label}: ${formatValue(chart.now, chart.unit)}${chart.unit}`}
      >
        <Marks chart={chart} s={s} box={box} clockMinute={clockMinute} labelled={false} />
        <path
          d={toPath(chart.observed, s)}
          fill="none"
          stroke={OBSERVED}
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        {chart.forecasts.map((f) => (
          <path
            key={f.scenarioId}
            d={toPath(f.points, s)}
            fill="none"
            stroke={scenarioColor(forkIds, f.scenarioId)}
            stroke-width="1.5"
            stroke-dasharray="4 3.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            data-testid={`forecast-${chart.id}-${f.scenarioId}`}
          />
        ))}
      </svg>
    </div>
  );
}

export function MetricCharts({ data }: { data: CanvasData }) {
  const forkIds = data.scenarios.filter((s) => s.id !== "main").map((s) => s.id);
  const forecasting = data.scenarios.filter((s) => s.id !== "main" && s.actions.length > 0);
  const [hero, ...rest] = data.charts;

  return (
    <section class="rounded-2xl border border-ink-800/80 bg-ink-925/60 p-3.5" data-testid="signals">
      <div class="mb-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div class="flex items-baseline gap-3">
          <h2 class="fl-eyebrow text-ink-300">Signals</h2>
          <span class="text-[11px] text-ink-500">
            {forecasting.length > 0
              ? "solid observed · dashed forecast per scenario"
              : `per-minute · ${data.charts[0]?.observed.length ?? 0} min observed`}
          </span>
        </div>
        {forecasting.length > 0 && <Legend forkIds={forkIds} forecasting={forecasting} />}
      </div>

      {hero && <HeroChart chart={hero} forkIds={forkIds} clockMinute={data.clockMinute} />}

      <div class="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {rest.map((chart) => (
          <MiniChart
            key={chart.id}
            chart={chart}
            forkIds={forkIds}
            clockMinute={data.clockMinute}
          />
        ))}
      </div>
    </section>
  );
}
