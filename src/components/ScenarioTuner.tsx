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
            enum: ["bypass_price_cache", "rollback_deploy", "scale_checkout", "purge_edge_cache"],
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
          mitigation !== "bypass_price_cache" &&
          mitigation !== "rollback_deploy" &&
          mitigation !== "scale_checkout" &&
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
      class="fl-pop fixed bottom-[4.75rem] left-5 z-40 flex items-center gap-2.5 rounded-full border border-sky-500/40 bg-ink-900/95 py-2 pr-4 pl-3 shadow-[0_18px_50px_-18px_rgb(56_189_248/0.65)] backdrop-blur-xl"
      data-testid="tuner-chip"
    >
      <span class="fl-live relative inline-block h-2 w-2 rounded-full bg-sky-400 text-sky-400" />
      <span class="flex flex-col leading-none">
        <span class="fl-eyebrow text-sky-400/80">dynamic tool bound</span>
        <span class="mt-1 font-mono text-[12px] text-sky-200">
          scenario_tune → {focused.name}
        </span>
      </span>
    </div>
  );
}
