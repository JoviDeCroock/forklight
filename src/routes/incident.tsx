import { useState } from "preact/hooks";
import type { LoaderArgs, RouteComponentProps } from "@pracht/core";
import { buildCanvasData } from "../server/canvas.ts";
import { loadState } from "../server/store.ts";
import { TopBar } from "../components/TopBar.tsx";
import { MetricCharts } from "../components/MetricCharts.tsx";
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
    <div class="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 pb-6" data-testid="canvas">
      <TopBar incident={data.incident} clock={data.clock} />
      <div class="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <div class="flex min-w-0 flex-col gap-4">
          <MetricCharts data={data} />
          <ScenarioTree data={data} focused={focused} onFocus={setFocused} />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <StagedPanel data={data} />
          <LedgerFeed entries={data.ledger} />
        </div>
      </div>
      <ScenarioTuner focused={focusedScenario} />
      <footer class="mt-6 border-t border-zinc-900 pt-3 text-xs text-zinc-600">
        One contract for humans and agents — UI, HTTP, and WebMCP projections of the same typed
        capabilities, via{" "}
        <a class="text-zinc-500 underline hover:text-zinc-300" href="https://pracht.resynapse.dev">
          pracht
        </a>
        . The production switch is deliberately not an agent tool.
      </footer>
    </div>
  );
}

export function head() {
  return { title: "INC-2107 · Forklight" };
}
