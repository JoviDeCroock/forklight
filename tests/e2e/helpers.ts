import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * The complete WebMCP tool surface Forklight projects, sorted. `mitigation.apply`
 * (destructive) and `incident.reset` (http-only) are deliberately absent — the
 * framework refuses to project a destructive capability as a page tool, and that
 * absence is the product's thesis.
 */
export const EXPECTED_TOOLS = [
  "incident.snapshot",
  "mitigation.stage",
  "scenario.compare",
  "scenario.fork",
  "scenario.simulate",
  "signals.query",
].sort();

/** Registration lags page load; the hook's own view lags registration again. */
const REGISTRATION_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1_500;

export interface Envelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; confirmationToken?: string };
}

export interface SnapshotData {
  incident: { id: string; title: string; status: string; applied: unknown };
  clock: string;
  scenarios: {
    id: string;
    name: string;
    actions: { mitigation: string; atMinute: number }[];
  }[];
  staged: { id: string; scenarioId: string; mitigation: string; stagedVia: string; status: string }[];
  ledger: { actor: string; capability: string; summary: string }[];
}

/** Open a fresh page on the canvas and wait until the page tools are live. */
export async function openCanvas(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/");
  await waitForTools(page);
  return page;
}

/** Wait until the testing hook reports at least `minimum` registered tools. */
export async function waitForTools(page: Page, minimum = EXPECTED_TOOLS.length): Promise<void> {
  await page.waitForFunction(
    async (min: number) => {
      const listed = await navigator.modelContextTesting?.listTools?.();
      return Array.isArray(listed) && listed.length >= min;
    },
    minimum,
    { timeout: REGISTRATION_TIMEOUT_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
}

/** Wait until a specific tool name shows up in the hook's view. */
export async function waitForToolNamed(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    async (wanted: string) => {
      const listed = await navigator.modelContextTesting?.listTools?.();
      return Array.isArray(listed) && listed.some((tool) => tool.name === wanted);
    },
    name,
    { timeout: REGISTRATION_TIMEOUT_MS },
  );
  await page.waitForTimeout(SETTLE_MS);
}

export async function listToolNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const listed = (await navigator.modelContextTesting!.listTools()) ?? [];
    return listed.map((tool) => tool.name).sort();
  });
}

/**
 * Full page-side tool descriptors, including the annotations the automation
 * hook strips out (`listTools()` only carries name/description/inputSchema).
 */
export async function listPageTools(page: Page): Promise<WebMcpPageToolDescriptor[]> {
  return page.evaluate(async () => {
    const tools = (await document.modelContext?.getTools()) ?? [];
    // Descriptors carry a live `window` reference, so copy only what travels.
    return tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      annotations: tool.annotations ? { ...tool.annotations } : undefined,
    }));
  });
}

/** Drive one tool exactly as an agent host would, and parse the envelope. */
export async function execTool<T = unknown>(
  page: Page,
  name: string,
  input: unknown,
): Promise<Envelope<T>> {
  const raw = await page.evaluate(
    (args: { name: string; input: string }) =>
      navigator.modelContextTesting!.executeTool(args.name, args.input),
    { name, input: JSON.stringify(input) },
  );
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as Envelope<T>;
}

export async function snapshot(page: Page): Promise<SnapshotData> {
  const envelope = await execTool<SnapshotData>(page, "incident.snapshot", {});
  expect(envelope.ok, `incident.snapshot failed: ${JSON.stringify(envelope.error)}`).toBe(true);
  return envelope.data!;
}

export interface AgentRunResult {
  scenarioId: string;
  proposalId: string;
}

/**
 * The demo flow, driven entirely through WebMCP page tools:
 * fork → simulate → stage. Returns the ids the DOM assertions key off.
 */
export async function runAgentFlow(
  page: Page,
  options: { mitigation?: string; rationale?: string } = {},
): Promise<AgentRunResult> {
  const mitigation = options.mitigation ?? "bypass_price_cache";

  const forked = await execTool<{ result: string; scenario: { id: string } }>(page, "scenario.fork", {
    name: "Bypass price cache",
    hypothesis: "Errors stop if cart pricing skips the new edge cache",
  });
  expect(forked.ok, JSON.stringify(forked.error)).toBe(true);
  expect(forked.data!.result).toBe("ok");
  const scenarioId = forked.data!.scenario.id;

  const simulated = await execTool<{ result: string }>(page, "scenario.simulate", {
    scenario: scenarioId,
    mitigation,
  });
  expect(simulated.ok, JSON.stringify(simulated.error)).toBe(true);
  expect(simulated.data!.result).toBe("ok");

  const staged = await execTool<{ result: string; staged: { id: string; stagedVia: string } }>(
    page,
    "mitigation.stage",
    {
      scenario: scenarioId,
      rationale: options.rationale ?? "Fastest recovery with a moderate, reversible blast radius.",
      evidence: ["checkout_error_rate 14:05–14:32", "edge-cache key fragmentation warnings"],
    },
  );
  expect(staged.ok, JSON.stringify(staged.error)).toBe(true);
  expect(staged.data!.result).toBe("ok");
  expect(staged.data!.staged.stagedVia).toBe("webmcp");

  return { scenarioId, proposalId: staged.data!.staged.id };
}

export function ledgerEntries(page: Page) {
  return page.locator('[data-testid="ledger-entry"]');
}
