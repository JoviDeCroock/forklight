import type { CanvasData } from "../server/canvas.ts";

const INCIDENT_MINUTE = 35;

/**
 * The observed record: what shipped, when it broke, and what paged. One shared
 * time rail from the start of the window to the frozen "now", so the deploy
 * that caused the incident and the alerts that followed it sit on the same
 * axis the reader just scanned in the charts.
 */
export function IncidentTimeline({ data }: { data: CanvasData }) {
  const span = Math.max(1, data.clockMinute);
  const pct = (minute: number) => `${((minute / span) * 100).toFixed(2)}%`;
  const ticks: number[] = [];
  for (let minute = 0; minute <= data.clockMinute; minute += 15) ticks.push(minute);

  return (
    <section
      class="rounded-2xl border border-ink-800/80 bg-ink-925/60 p-3.5"
      data-testid="incident-timeline"
    >
      <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div class="flex items-baseline gap-3">
          <h2 class="fl-eyebrow text-ink-300">Observed record</h2>
          <span class="text-[11px] text-ink-500">deploys and alerts on the incident clock</span>
        </div>
        <span class="fl-nums font-mono text-[10.5px] text-ink-500">
          13:30 → {data.clock} · incident opened {data.incident.startedAtClock}
        </span>
      </div>

      {/* rail */}
      <div class="relative mb-2.5 h-8">
        <div class="absolute inset-x-0 top-4 h-px bg-ink-800" />
        <div
          class="absolute top-4 h-px bg-gradient-to-r from-rose-500/70 to-rose-500/25"
          style={{ left: pct(INCIDENT_MINUTE), right: "0%" }}
        />
        {ticks.map((minute) => (
          <div key={minute} class="absolute top-4" style={{ left: pct(minute) }}>
            <span class="absolute -top-1 block h-2 w-px bg-ink-750" />
            <span class="fl-nums absolute top-2.5 -translate-x-1/2 font-mono text-[9.5px] text-ink-500">
              {minuteLabel(minute)}
            </span>
          </div>
        ))}

        {data.deploys.map((deploy) => {
          const culprit = deploy.minute === INCIDENT_MINUTE;
          return (
            <div
              key={deploy.id}
              class="absolute -top-2 flex -translate-x-1/2 flex-col items-center"
              style={{ left: pct(deploy.minute) }}
              title={deploy.summary}
            >
              <span
                class={`fl-nums mb-1 rounded border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap ${
                  culprit
                    ? "border-amber-500/45 bg-amber-500/12 text-amber-200"
                    : "border-ink-750 bg-ink-900 text-ink-400"
                }`}
              >
                {deploy.service}@{deploy.version.replace("v", "")}
              </span>
              <span
                class={`h-2 w-2 rotate-45 ${culprit ? "bg-amber-400" : "bg-ink-600"}`}
                aria-hidden="true"
              />
            </div>
          );
        })}

        {data.alerts.map((alert) => (
          <span
            key={alert.id}
            class={`absolute top-[11px] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-ink-925 ${
              alert.severity === "page" ? "bg-rose-400" : "bg-amber-300"
            }`}
            style={{ left: pct(alert.minute) }}
            title={`${alert.atClock} ${alert.summary}`}
          />
        ))}

        <span class="absolute top-2 right-0 h-5 w-px bg-ink-300" aria-hidden="true" />
        <span class="fl-nums absolute top-0 right-0 translate-x-1 -translate-y-[2px] font-mono text-[9.5px] text-ink-300">
          now
        </span>
      </div>

      <div class="grid gap-2 lg:grid-cols-3">
        <div class="flex min-w-0 items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-1.5">
          <span class="h-1.5 w-1.5 shrink-0 rotate-45 bg-amber-400" aria-hidden="true" />
          <span class="fl-nums shrink-0 font-mono text-[11px] text-amber-200">
            {data.deploys[data.deploys.length - 1]?.atClock}
          </span>
          <span class="fl-eyebrow shrink-0 rounded bg-amber-500/12 px-1 py-0.5 text-amber-200">
            deploy
          </span>
          <span class="truncate text-[12px] text-ink-300">
            edge price cache for cart pricing (price:v2)
          </span>
        </div>
        {data.alerts.map((alert) => (
          <div
            key={alert.id}
            class="flex min-w-0 items-center gap-2.5 rounded-lg border border-ink-800/70 bg-ink-900/50 px-3 py-1.5"
          >
            <span
              class={`h-1.5 w-1.5 shrink-0 rounded-full ${
                alert.severity === "page" ? "bg-rose-400" : "bg-amber-300"
              }`}
              aria-hidden="true"
            />
            <span class="fl-nums shrink-0 font-mono text-[11px] text-ink-300">{alert.atClock}</span>
            <span
              class={`fl-eyebrow shrink-0 rounded px-1 py-0.5 ${
                alert.severity === "page"
                  ? "bg-rose-500/12 text-rose-300"
                  : "bg-amber-500/12 text-amber-200"
              }`}
            >
              {alert.severity}
            </span>
            <span class="truncate text-[12px] text-ink-300">{alert.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function minuteLabel(minute: number): string {
  const total = 13 * 60 + 30 + minute;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
