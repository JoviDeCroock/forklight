import { expect, test } from "@playwright/test";
import { ledgerEntries, openCanvas, runAgentFlow } from "./helpers.ts";

test("the agent stages, the human applies through the confirmation flow", async ({ context }) => {
  const page = await openCanvas(context);
  const clockBefore = (await page.getByTestId("clock").textContent())?.trim();
  expect(clockBefore).toBe("14:32");

  const { proposalId } = await runAgentFlow(page);
  await expect(page.getByTestId(`proposal-${proposalId}`)).toBeVisible();
  await expect(page.getByTestId("incident-status")).toHaveText("open");

  // Human clicks the switch no tool can reach. This is a `prepare: true`
  // dispatch: the destructive capability answers 409 confirmation_required
  // with a short-lived token, which the page turns into a dialog.
  await page.getByTestId(`apply-${proposalId}`).click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await expect(page.getByTestId("confirm-modal")).toContainText("Apply to production?");

  // Commit: same input, plus the x-pracht-confirm token.
  await page.getByTestId("confirm-commit").click();
  await expect(page.getByTestId("confirm-modal")).toHaveCount(0);

  // bypass_response_cache recovers, so the incident lands on "recovered";
  // accept "mitigating" too so the assertion tracks the flow, not the model.
  await expect(page.getByTestId("incident-status")).toHaveText(/^(recovered|mitigating)$/);
  await expect(page.getByTestId("applied-card")).toBeVisible();
  await expect(page.getByTestId("applied-card")).toContainText("Bypass the new response cache");
  await expect(page.getByTestId("applied-card")).toContainText("applied");

  // Applying advances the narrative clock past the lead time so recovery is
  // observed rather than only forecast.
  await expect(page.getByTestId("clock")).not.toHaveText(clockBefore!);
  await expect(page.getByTestId("clock")).toHaveText("14:42");

  // The ledger records who did it: the apply row is attributed to the human.
  const applyRow = ledgerEntries(page).filter({ hasText: "mitigation.apply" });
  await expect(applyRow).toHaveCount(1);
  await expect(applyRow).toContainText("you");
  await expect(applyRow).toContainText("APPLIED");
  // ...while the staging that preceded it is still attributed to the agent.
  await expect(ledgerEntries(page).filter({ hasText: "mitigation.stage" })).toContainText("agent");

  // The proposal is consumed: no second apply button remains.
  await expect(page.getByTestId(`apply-${proposalId}`)).toHaveCount(0);
});
