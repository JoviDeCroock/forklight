import { useState } from "preact/hooks";
import type { LoaderArgs, RouteComponentProps } from "@pracht/core";
import { buildCanvasData } from "../server/canvas.ts";
import { loadState } from "../server/store.ts";
import { TopBar } from "../components/TopBar.tsx";
import { MetricCharts } from "../components/MetricCharts.tsx";
import { IncidentTimeline } from "../components/IncidentTimeline.tsx";
import { ScenarioTree } from "../components/ScenarioTree.tsx";
import { StagedPanel } from "../components/StagedPanel.tsx";
import { LedgerFeed } from "../components/LedgerFeed.tsx";
import { ScenarioTuner } from "../components/ScenarioTuner.tsx";

export async function loader({ context }: LoaderArgs) {
  const sessionId = context.sessionId;
  if (!sessionId) throw new Error("session middleware did not run");
  const db = context.env.DB;
  const state = await loadState(db, sessionId);
  return buildCanvasData(db, sessionId, state);
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const [focused, setFocused] = useState<string | null>(null);
  const focusedScenario = data.scenarios.find((s) => s.id === focused && s.id !== "main") ?? null;

  return (
    <div
      class="mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 pb-5 md:px-6"
      data-testid="canvas"
    >
      <TopBar incident={data.incident} clock={data.clock} />

      <main class="mt-3.5 grid flex-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div class="flex min-w-0 flex-col gap-3.5 lg:min-h-[calc(100vh-9.5rem)]">
          <MetricCharts data={data} />
          <IncidentTimeline data={data} />
          <ScenarioTree data={data} focused={focused} onFocus={setFocused} />
        </div>
        {/* Not sticky on purpose: `position: sticky` creates a stacking context,
            which would trap the apply-confirmation modal below the top bar. */}
        <div class="flex min-w-0 flex-col gap-3.5 lg:h-[calc(100vh-9.5rem)]">
          <StagedPanel data={data} />
          <LedgerFeed entries={data.ledger} />
        </div>
      </main>

      <ScenarioTuner focused={focusedScenario} />

      <footer class="mt-3.5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-ink-800/70 pt-3">
        <p class="max-w-[70ch] text-[11.5px] leading-relaxed text-ink-400">
          <span class="text-ink-200">One contract for humans and agents.</span> The UI, the HTTP
          endpoints, and the WebMCP page tools are three projections of the same typed capabilities,
          via{" "}
          <a
            class="text-ink-200 underline decoration-ink-600 underline-offset-2 transition-colors hover:text-sky-300 hover:decoration-sky-400"
            href="https://pracht.resynapse.dev"
          >
            pracht
          </a>
          .
        </p>
        <span class="ml-auto flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/[0.07] py-1 pr-3 pl-2.5">
          <svg
            viewBox="0 0 12 12"
            class="h-3 w-3 shrink-0 text-violet-300"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 0a2.6 2.6 0 0 0-2.6 2.6V4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-.4V2.6A2.6 2.6 0 0 0 6 0Zm1.4 4H4.6V2.6a1.4 1.4 0 1 1 2.8 0V4Z" />
          </svg>
          <span class="font-mono text-[11px] text-violet-200">mitigation.apply</span>
          <span class="text-[11px] text-ink-400">is deliberately not an agent tool</span>
        </span>
      </footer>
    </div>
  );
}

export function head() {
  return { title: "INC-2107 · Forklight" };
}
