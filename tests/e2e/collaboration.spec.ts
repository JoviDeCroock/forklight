import { expect, test } from "@playwright/test";
import { ledgerEntries, openCanvas, runAgentFlow } from "./helpers.ts";

test("an agent's tool calls move the canvas the human is looking at", async ({ context }) => {
  const page = await openCanvas(context);

  // Pristine session: no forks, no proposals, empty ledger.
  await expect(page.locator('[data-testid^="scenario-s-"]')).toHaveCount(0);
  await expect(ledgerEntries(page)).toHaveCount(0);

  const { scenarioId, proposalId } = await runAgentFlow(page);
  expect(scenarioId).toBe("s-1");

  // No reload anywhere in this test: pracht revalidates the route after each
  // successful non-read dispatch, so the loader re-reads D1 and the canvas
  // repaints while the agent works.
  await expect(page.getByTestId(`scenario-${scenarioId}`)).toBeVisible();
  await expect(page.getByTestId(`scenario-${scenarioId}`)).toContainText("Bypass the new price cache");

  // The forecast overlay for this scenario is drawn on the error-rate chart.
  await expect(page.getByTestId(`forecast-checkout_error_rate-${scenarioId}`)).toHaveCount(1);

  const proposal = page.getByTestId(`proposal-${proposalId}`);
  await expect(proposal).toBeVisible();
  await expect(proposal).toContainText("staged via agent (WebMCP)");
  await expect(proposal).toContainText("Bypass the new price cache");
  // The human-only switch is on the proposal, not on the tool surface.
  await expect(page.getByTestId(`apply-${proposalId}`)).toBeVisible();

  // fork + simulate + stage each append one ledger row, all attributed to the
  // agent via the `x-pracht-transport: webmcp` marker the projection sends.
  await expect(ledgerEntries(page)).toHaveCount(3);

  const forkRow = ledgerEntries(page).filter({ hasText: "scenario.fork" });
  await expect(forkRow).toHaveCount(1);
  await expect(forkRow).toContainText("agent");

  const stageRow = ledgerEntries(page).filter({ hasText: "mitigation.stage" });
  await expect(stageRow).toContainText("agent");
  await expect(stageRow).toContainText("for human review");

  // Nothing the agent did touched production.
  await expect(page.getByTestId("incident-status")).toHaveText("open");
  await expect(page.getByTestId("applied-card")).toHaveCount(0);
});
