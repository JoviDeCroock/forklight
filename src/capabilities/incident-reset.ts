import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { openSession } from "../server/session-io.ts";
import { resetSession } from "../server/store.ts";

export default defineCapability({
  title: "Reset the demo incident",
  description:
    "Restore this session's incident to the pristine seeded state and clear its activity ledger. Http-only: the reset button in the page, not part of the agent tool surface.",
  input: { type: "object", properties: {}, additionalProperties: false },
  output: {
    type: "object",
    properties: { result: { type: "string", enum: ["ok"] } },
    required: ["result"],
  },
  effect: "write",
  middleware: ["session"],
  expose: { http: true },
  async run({ request, context }: CapabilityRunArgs<Record<never, never>>) {
    const io = await openSession({ request, context });
    await resetSession(io.db, io.sessionId);
    return { result: "ok" };
  },
});
