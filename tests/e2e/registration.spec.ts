import { expect, test } from "@playwright/test";
import { EXPECTED_TOOLS, execTool, listPageTools, listToolNames, openCanvas } from "./helpers.ts";

// Playwright gives every test a fresh browser context, so every test below
// starts on a brand-new anonymous session cookie and a pristine incident.
test.describe("WebMCP tool registration", () => {
  test("registers exactly the six read/write capabilities", async ({ context }) => {
    const page = await openCanvas(context);

    expect(await listToolNames(page)).toEqual(EXPECTED_TOOLS);
  });

  test("does not register the destructive or http-only capabilities", async ({ context }) => {
    const page = await openCanvas(context);
    const names = await listToolNames(page);

    // mitigation.apply is `effect: "destructive"` — pracht refuses to project
    // it as a page tool at all. incident.reset is `expose: { http: true }`.
    expect(names).not.toContain("mitigation.apply");
    expect(names).not.toContain("incident.reset");
    // The dotted capability names are the tool names; guard against a rename
    // sneaking an apply-shaped tool in under another spelling.
    expect(names.filter((name) => name.includes("apply"))).toEqual([]);
    expect(names.filter((name) => name.includes("reset"))).toEqual([]);
  });

  test("the page agrees with the hook about how many tools are live", async ({ context }) => {
    const page = await openCanvas(context);

    await expect(page.getByTestId("tool-count")).toHaveText(
      `${EXPECTED_TOOLS.length} agent tools live`,
    );
  });

  test("incident.snapshot executes and reports the seeded incident", async ({ context }) => {
    const page = await openCanvas(context);

    const envelope = await execTool<{
      incident: { id: string; status: string };
      clock: string;
      scenarios: { id: string }[];
      usage: string;
    }>(page, "incident.snapshot", {});

    expect(envelope.ok, JSON.stringify(envelope.error)).toBe(true);
    expect(envelope.data!.incident.id).toBe("INC-2107");
    expect(envelope.data!.incident.status).toBe("open");
    expect(envelope.data!.clock).toBe("14:32");
    expect(envelope.data!.scenarios.map((scenario) => scenario.id)).toEqual(["main"]);
  });

  test("annotations carry the untrusted-content hint on signals.query", async ({ context }) => {
    const page = await openCanvas(context);

    // navigator.modelContextTesting.listTools() strips annotations — it only
    // returns { name, description, inputSchema }. document.modelContext
    // .getTools() (the page-facing API an embedded agent host reads) keeps
    // them, so the annotation assertion goes through that surface instead.
    const hookTools = await page.evaluate(async () =>
      (await navigator.modelContextTesting!.listTools()).map((tool) => Object.keys(tool).sort()),
    );
    expect(hookTools).toHaveLength(EXPECTED_TOOLS.length);
    expect(
      hookTools.every((keys) => !keys.includes("annotations")),
      "the testing hook started exposing annotations — assert on it directly instead",
    ).toBe(true);

    const pageTools = await listPageTools(page);
    expect(pageTools.map((tool) => tool.name).sort()).toEqual(EXPECTED_TOOLS);

    const signals = pageTools.find((tool) => tool.name === "signals.query");
    // Log lines embed user-controlled fields, so the tool must warn hosts.
    expect(signals?.annotations?.untrustedContentHint).toBe(true);

    const snapshot = pageTools.find((tool) => tool.name === "incident.snapshot");
    expect(snapshot?.annotations?.readOnlyHint).toBe(true);
    expect(snapshot?.annotations?.untrustedContentHint).toBe(false);

    const fork = pageTools.find((tool) => tool.name === "scenario.fork");
    expect(fork?.annotations?.readOnlyHint).toBe(false);
  });
});
