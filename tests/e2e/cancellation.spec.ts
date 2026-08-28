import { expect, test } from "@playwright/test";
import { openCanvas, snapshot } from "./helpers.ts";

/**
 * Cancellation proof at the transport this app owns.
 *
 * `navigator.modelContextTesting.executeTool(name, inputJson)` takes no
 * AbortSignal and returns no handle to cancel with (its arity is 2), so the
 * automation hook cannot prove cancellation end to end. What the page *can*
 * prove is the leg underneath it: a page tool's `execute(input, { signal })`
 * hands that signal to `callCapability()`, which hands it to `fetch`. This
 * spec drives that same HTTP dispatch from page context with an
 * AbortController and asserts the request actually aborts — see
 * src/components/ScenarioTuner.tsx, where the registered tool forwards
 * `signal` into `callCapability(..., { signal })`.
 */
const CAPABILITY_URL = "/api/capabilities/signals/query";
const INPUT = { signal: "checkout_error_rate", windowMinutes: 30 };

test.describe("AbortSignal propagation", () => {
  test("an aborted capability dispatch rejects with AbortError", async ({ context }) => {
    const page = await openCanvas(context);
    // Guard the premise of this spec: if the hook ever grows a third
    // parameter (an options bag with a signal), test cancellation there too.
    expect(await page.evaluate(() => navigator.modelContextTesting!.executeTool.length)).toBe(2);

    const result = await page.evaluate(
      async (args: { url: string; input: unknown }) => {
        const controller = new AbortController();
        const promise = fetch(args.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-pracht-transport": "webmcp" },
          body: JSON.stringify(args.input),
          signal: controller.signal,
        });
        // Abort while the request is in flight.
        setTimeout(() => controller.abort(), 1);
        try {
          const response = await promise;
          return { settled: "resolved" as const, status: response.status, name: null };
        } catch (error) {
          return {
            settled: "rejected" as const,
            status: null,
            name: error instanceof Error ? error.name : String(error),
          };
        }
      },
      { url: CAPABILITY_URL, input: INPUT },
    );

    expect(result.settled).toBe("rejected");
    expect(result.name).toBe("AbortError");
  });

  test("an already-aborted signal never reaches the capability", async ({ context }) => {
    const page = await openCanvas(context);

    // signals.query appends one ledger row per dispatch, so the server-side
    // ledger is the witness: if the aborted request had reached the
    // capability, a row would appear.
    const countQueries = async () =>
      (await snapshot(page)).ledger.filter((entry) => entry.capability === "signals.query").length;
    const before = await countQueries();

    const result = await page.evaluate(
      async (args: { url: string; input: unknown }) => {
        const controller = new AbortController();
        controller.abort();
        try {
          await fetch(args.url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args.input),
            signal: controller.signal,
          });
          return { settled: "resolved" as const, name: null };
        } catch (error) {
          return {
            settled: "rejected" as const,
            name: error instanceof Error ? error.name : String(error),
          };
        }
      },
      { url: CAPABILITY_URL, input: INPUT },
    );

    expect(result.settled).toBe("rejected");
    expect(result.name).toBe("AbortError");
    expect(await countQueries()).toBe(before);
  });

  test("the same dispatch succeeds when it is not aborted", async ({ context }) => {
    const page = await openCanvas(context);

    // Control: without the abort the identical request answers ok, so the
    // rejections above are cancellation and not a broken request.
    const result = await page.evaluate(
      async (args: { url: string; input: unknown }) => {
        const response = await fetch(args.url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-pracht-transport": "webmcp" },
          body: JSON.stringify(args.input),
        });
        return { status: response.status, body: await response.json() };
      },
      { url: CAPABILITY_URL, input: INPUT },
    );

    expect(result.status).toBe(200);
    expect((result.body as { ok: boolean }).ok).toBe(true);
    expect((result.body as { data: { kind: string } }).data.kind).toBe("series");
  });
});
