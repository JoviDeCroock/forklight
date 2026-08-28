import { expect, test } from "@playwright/test";
import {
  EXPECTED_TOOLS,
  execTool,
  listToolNames,
  openCanvas,
  snapshot,
  waitForToolNamed,
  waitForTools,
} from "./helpers.ts";

/**
 * `scenario_tune` is registered by the page itself with
 * `document.modelContext.registerTool()` — not through pracht's projection —
 * the moment the human focuses a scenario card. Its *target* is whatever the
 * human is looking at: the human's click picks the object, the agent picks the
 * verb.
 */
test("the hand-registered tool follows the human's focus", async ({ context }) => {
  const page = await openCanvas(context);

  const forked = await execTool<{ scenario: { id: string } }>(page, "scenario.fork", {
    name: "Bypass response cache",
    hypothesis: "Errors stop if web skips the new edge cache",
  });
  expect(forked.ok, JSON.stringify(forked.error)).toBe(true);
  const scenarioId = forked.data!.scenario.id;

  const simulated = await execTool<{ result: string }>(page, "scenario.simulate", {
    scenario: scenarioId,
    mitigation: "bypass_response_cache",
  });
  expect(simulated.data!.result).toBe("ok");

  // Reload to prove registration is driven by focus on a fresh document, not
  // by leftover state from the dispatches above.
  await page.reload();
  await waitForTools(page);

  const card = page.getByTestId(`scenario-${scenarioId}`);
  await expect(card).toBeVisible();
  expect(await listToolNames(page)).toEqual(EXPECTED_TOOLS);
  await expect(page.getByTestId("tuner-chip")).toHaveCount(0);

  // --- focus -----------------------------------------------------------
  await card.click();
  await expect(page.getByTestId("tuner-chip")).toBeVisible();
  await expect(page.getByTestId("tuner-chip")).toContainText("scenario_tune");
  await waitForToolNamed(page, "scenario_tune");
  expect(await listToolNames(page)).toEqual([...EXPECTED_TOOLS, "scenario_tune"].sort());

  const tuned = await execTool<{ result: string; assessment: { scenarioId: string } }>(
    page,
    "scenario_tune",
    { mitigation: "purge_edge_cache" },
  );
  expect(tuned.ok, JSON.stringify(tuned.error)).toBe(true);
  expect(tuned.data!.result).toBe("ok");
  // The tool never received a scenario id — it resolved the target from focus.
  expect(tuned.data!.assessment.scenarioId).toBe(scenarioId);

  const afterTune = await snapshot(page);
  const target = afterTune.scenarios.find((scenario) => scenario.id === scenarioId);
  expect(target?.actions.map((action) => action.mitigation)).toEqual([
    "bypass_response_cache",
    "purge_edge_cache",
  ]);
  await expect(card).toContainText("Purge the edge cache");

  // --- unfocus ---------------------------------------------------------
  await card.click();
  await expect(page.getByTestId("tuner-chip")).toHaveCount(0);

  // Chromium <=152 has no unregisterTool(), so the tool stays listed. The
  // spec-conformant answer is a typed error, not a vanished tool.
  expect(await listToolNames(page)).toContain("scenario_tune");

  const refused = await execTool(page, "scenario_tune", { mitigation: "rollback_deploy" });
  expect(refused.ok).toBe(false);
  expect(refused.error?.code).toBe("no_focus");

  // Nothing was simulated behind the human's back.
  const afterRefusal = await snapshot(page);
  expect(
    afterRefusal.scenarios
      .find((scenario) => scenario.id === scenarioId)
      ?.actions.map((action) => action.mitigation),
  ).toEqual(["bypass_response_cache", "purge_edge_cache"]);
});
