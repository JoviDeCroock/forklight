// The production switch. Classified `destructive`, so pracht refuses to
// project it as a WebMCP page tool — the framework enforces what the product
// promises: agents investigate and prepare, a person applies. Every dispatch
// runs the prepare/commit confirmation flow (409 + token, then a byte-identical
// committed call).
import { defineCapability, type CapabilityRunArgs } from "@pracht/capabilities";
import { MITIGATIONS, metricAt, minuteToClock } from "../server/incident.ts";
import { openSession } from "../server/session-io.ts";

interface ApplyInput {
  proposal: string;
}

export default defineCapability({
  title: "Apply staged mitigation to production",
  description:
    "Apply a staged proposal to the production incident. Human-only: this is deliberately not exposed as a WebMCP tool, and every call is confirmation-gated.",
  input: {
    type: "object",
    properties: {
      proposal: { type: "string", maxLength: 32, description: "Staged proposal id." },
    },
    required: ["proposal"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      result: { type: "string", enum: ["ok", "unknown_proposal", "already_applied"] },
      incident: { type: "object" },
      appliedAtClock: { type: "string" },
      clockNow: { type: "string" },
    },
    required: ["result"],
  },
  effect: "destructive",
  middleware: ["session"],
  expose: { http: true },
  async run({ input, request, context }: CapabilityRunArgs<ApplyInput>) {
    const startedAt = performance.now();
    const io = await openSession({ request, context });
    const { state } = io;
    const proposal = state.staged.find((s) => s.id === input.proposal);
    if (!proposal || proposal.status === "dismissed") {
      await io.log("mitigation.apply", `Unknown proposal ${input.proposal}`, startedAt, "error");
      return { result: "unknown_proposal" };
    }
    if (proposal.status === "applied" || state.incident.applied) {
      await io.log("mitigation.apply", "A mitigation is already applied", startedAt, "error");
      return { result: "already_applied" };
    }
    const info = MITIGATIONS[proposal.mitigation];
    const appliedAt = state.clockMinute;
    proposal.status = "applied";
    state.incident.applied = { mitigation: proposal.mitigation, atMinute: appliedAt, scenarioId: proposal.scenarioId };
    // Advance the narrative clock past the lead time plus stabilisation so the
    // observed timeline shows the recovery (or its absence) rather than only a
    // forecast.
    state.clockMinute = appliedAt + info.leadTimeMinutes + 8;
    const errorNow = metricAt("web_error_rate", state.clockMinute, [
      { mitigation: proposal.mitigation, atMinute: appliedAt },
    ]);
    state.incident.status = errorNow < 1 ? "recovered" : "mitigating";
    await io.save();
    await io.log(
      "mitigation.apply",
      `APPLIED “${info.title}” to production — incident ${state.incident.status}`,
      startedAt,
    );
    return {
      result: "ok",
      incident: state.incident,
      appliedAtClock: minuteToClock(appliedAt),
      clockNow: minuteToClock(state.clockMinute),
    };
  },
});
