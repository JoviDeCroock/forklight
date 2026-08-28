// Challenge-specific direct WebMCP integration, alongside pracht's generated
// tool projection: one hand-registered page tool whose *target* is the
// scenario the human currently has focused in the canvas. The human's click
// changes what the agent's tool operates on — same-tab shared context in both
// directions. Registration is once-per-page (the CG draft removed
// unregisterTool(); Chromium adds signal-based lifecycle in 153) and the tool
// answers with a typed error while nothing is focused.
import { useEffect, useState } from "preact/hooks";
import { callCapability } from "virtual:pracht/capabilities";

interface Focus {
  id: string;
  name: string;
}

let currentFocus: Focus | null = null;
let registered = false;

interface TuneInput {
  mitigation?: string;
  delayMinutes?: number;
}

function registerTuner(): boolean {
  const modelContext = (
    document as {
      modelContext?: {
        registerTool?: (tool: Record<string, unknown>) => unknown;
      };
    }
  ).modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") return false;
  try {
    const registration = modelContext.registerTool({
      name: "scenario_tune",
      title: "Tune the focused scenario",
      description:
        "Simulate a mitigation inside the counterfactual scenario the human currently has focused in the Forklight canvas. The human's focus picks the target; you pick the action. Fails with no_focus when nothing is focused.",
      inputSchema: {
        type: "object",
        properties: {
          mitigation: {
            type: "string",
            enum: ["bypass_response_cache", "rollback_deploy", "scale_web", "purge_edge_cache"],
            description: "Mitigation to simulate in the focused scenario.",
          },
          delayMinutes: {
            type: "integer",
            minimum: 0,
            maximum: 30,
            description: "Start the action this many minutes after now (default 0).",
          },
        },
        required: ["mitigation"],
      },
      annotations: { readOnlyHint: false },
      async execute(rawInput: unknown, { signal }: { signal?: AbortSignal } = {}) {
        const focus = currentFocus;
        if (!focus) {
          return {
            ok: false,
            error: {
              code: "no_focus",
              message:
                "No scenario is focused in the page. Ask the human to focus one, or use scenario.simulate with an explicit scenario id.",
            },
          };
        }
        const input = (typeof rawInput === "string" ? JSON.parse(rawInput) : rawInput ?? {}) as TuneInput;
        const mitigation = input.mitigation;
        if (
          mitigation !== "bypass_response_cache" &&
          mitigation !== "rollback_deploy" &&
          mitigation !== "scale_web" &&
          mitigation !== "purge_edge_cache"
        ) {
          return {
            ok: false,
            error: { code: "invalid_input", message: "mitigation must be one of the catalog ids." },
          };
        }
        return callCapability(
          "scenario.simulate",
          {
            scenario: focus.id,
            mitigation,
            delayMinutes: input.delayMinutes ?? 0,
          },
          { headers: { "x-pracht-transport": "webmcp" }, signal },
        );
      },
    });
    if (registration && typeof (registration as Promise<unknown>).catch === "function") {
      (registration as Promise<unknown>).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export function ScenarioTuner({ focused }: { focused: Focus | null }) {
  const [live, setLive] = useState(false);

  useEffect(() => {
    currentFocus = focused ? { id: focused.id, name: focused.name } : null;
    if (focused && !registered) {
      registered = registerTuner();
    }
    setLive(registered && focused !== null);
  }, [focused]);

  if (!live || !focused) return null;
  return (
    <div
      class="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-sky-500/40 bg-zinc-900/95 px-3 py-1.5 text-xs text-sky-300 shadow-lg"
      data-testid="tuner-chip"
    >
      <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
      scenario_tune → {focused.name}
    </div>
  );
}
