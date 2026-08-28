import { expect, test } from "@playwright/test";
import { execTool, ledgerEntries, openCanvas, snapshot } from "./helpers.ts";

/**
 * Sessions are anonymous cookies minted by the route middleware on page load,
 * and the WebMCP projection dispatches same-origin with credentials — so an
 * agent operates in exactly the session the human in that tab is looking at,
 * and nowhere else.
 */
test("two visitors get two incidents, and reset only truncates one", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await openCanvas(contextA);
  const pageB = await openCanvas(contextB);

  // A's agent forks.
  const forkedA = await execTool<{ scenario: { id: string } }>(pageA, "scenario.fork", {
    name: "A: bypass response cache",
    hypothesis: "Errors stop if web skips the new edge cache",
  });
  expect(forkedA.ok, JSON.stringify(forkedA.error)).toBe(true);
  await expect(pageA.getByTestId(`scenario-${forkedA.data!.scenario.id}`)).toBeVisible();

  // B sees nothing of it — neither in the DOM nor through B's own tools.
  await pageB.reload();
  await expect(pageB.locator('[data-testid^="scenario-s-"]')).toHaveCount(0);
  await expect(ledgerEntries(pageB)).toHaveCount(0);
  const snapshotB = await snapshot(pageB);
  expect(snapshotB.scenarios.map((scenario) => scenario.id)).toEqual(["main"]);
  expect(snapshotB.ledger.filter((entry) => entry.capability === "scenario.fork")).toEqual([]);

  // Give B state of its own, so A's reset has something to fail to destroy.
  const forkedB = await execTool<{ scenario: { id: string } }>(pageB, "scenario.fork", {
    name: "B: roll back the deploy",
    hypothesis: "Errors stop if web returns to v8.3.0",
  });
  expect(forkedB.ok, JSON.stringify(forkedB.error)).toBe(true);
  const scenarioB = forkedB.data!.scenario.id;
  await expect(pageB.getByTestId(`scenario-${scenarioB}`)).toBeVisible();

  // A resets: the button dispatches incident.reset (http-only) then reloads.
  await expect(ledgerEntries(pageA)).not.toHaveCount(0);
  await pageA.getByTestId("reset").click();
  await expect(pageA.locator('[data-testid^="scenario-s-"]')).toHaveCount(0);
  await expect(ledgerEntries(pageA)).toHaveCount(0);
  await expect(pageA.getByTestId("incident-status")).toHaveText("open");
  await expect(pageA.getByTestId("clock")).toHaveText("now 14:32");

  // B is untouched.
  await pageB.reload();
  await expect(pageB.getByTestId(`scenario-${scenarioB}`)).toBeVisible();
  await expect(pageB.getByTestId(`scenario-${scenarioB}`)).toContainText("B: roll back the deploy");
  await expect(ledgerEntries(pageB)).not.toHaveCount(0);

  // ...and A's fork never leaked into B, even after the reset.
  const finalB = await snapshot(pageB);
  expect(finalB.scenarios.map((scenario) => scenario.name)).toEqual([
    "Observed timeline",
    "B: roll back the deploy",
  ]);

  await contextA.close();
  await contextB.close();
});
