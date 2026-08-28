import { beforeEach, describe, expect, it } from "vitest";
import { CONFIRMATION_HEADER, createCapabilityTestHost } from "@pracht/core";
import { CAPABILITY_TRANSPORT_HEADER } from "@pracht/capabilities";
import incidentSnapshot from "../../src/capabilities/incident-snapshot.ts";
import incidentReset from "../../src/capabilities/incident-reset.ts";
import mitigationApply from "../../src/capabilities/mitigation-apply.ts";
import mitigationStage from "../../src/capabilities/mitigation-stage.ts";
import scenarioCompare from "../../src/capabilities/scenario-compare.ts";
import scenarioFork from "../../src/capabilities/scenario-fork.ts";
import scenarioSimulate from "../../src/capabilities/scenario-simulate.ts";
import signalsQuery from "../../src/capabilities/signals-query.ts";
import { middleware as session } from "../../src/middleware/session.ts";
import { SESSION_HEADER } from "../../src/server/store.ts";
import { createFakeD1, type FakeD1 } from "./fake-d1.ts";

const SESSION_ID = "unit-test-session-0001";

interface Envelope<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; confirmationToken?: string; issues?: unknown[] };
}

interface Dispatch<T = Record<string, unknown>> {
  status: number;
  envelope: Envelope<T>;
}

function createHost() {
  const fake: FakeD1 = createFakeD1();
  const host = createCapabilityTestHost({
    capabilities: {
      "incident.snapshot": incidentSnapshot,
      "signals.query": signalsQuery,
      "scenario.fork": scenarioFork,
      "scenario.simulate": scenarioSimulate,
      "scenario.compare": scenarioCompare,
      "mitigation.stage": mitigationStage,
      "mitigation.apply": mitigationApply,
      "incident.reset": incidentReset,
    },
    middleware: { session },
    // Mirrors defineApp({ agents }) in src/routes.ts.
    agents: { confirmation: { ttlSeconds: 120 } },
  });

  async function call<T = Record<string, unknown>>(
    name: string,
    input: unknown,
    options: { headers?: Record<string, string>; session?: string | null } = {},
  ): Promise<Dispatch<T>> {
    const sessionId = options.session === undefined ? SESSION_ID : options.session;
    const headers: Record<string, string> = { ...options.headers };
    if (sessionId !== null) headers[SESSION_HEADER] = sessionId;
    const response = await host.request(name, input, {
      headers,
      context: { env: { DB: fake.db } },
    });
    return { status: response.status, envelope: (await response.json()) as Envelope<T> };
  }

  return { fake, call };
}

describe("input validation", () => {
  it("rejects an unknown signal with invalid_input", async () => {
    const { call } = createHost();
    const { status, envelope } = await call("signals.query", { signal: "not_a_signal" });

    expect(status).toBe(400);
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.code).toBe("invalid_input");
    expect(envelope.error?.issues?.length).toBeGreaterThan(0);
  });

  it("rejects an out-of-range delayMinutes before the capability runs", async () => {
    const { call, fake } = createHost();
    const { status, envelope } = await call("scenario.simulate", {
      scenario: "s-1",
      mitigation: "bypass_price_cache",
      delayMinutes: 999,
    });

    expect(status).toBe(400);
    expect(envelope.error?.code).toBe("invalid_input");
    // Nothing reached D1: validation runs before middleware and run().
    expect(fake.statements).toEqual([]);
  });
});

describe("the session middleware gates every dispatch", () => {
  it("refuses a capability call that carries no session", async () => {
    const { call } = createHost();
    const { status, envelope } = await call("incident.snapshot", {}, { session: null });

    expect(status).toBe(400);
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.code).toBe("middleware_rejected");
  });

  it("serves the seeded incident once a session is present", async () => {
    const { call, fake } = createHost();
    const { status, envelope } = await call<{
      incident: { id: string; status: string };
      clock: string;
      scenarios: { id: string }[];
    }>("incident.snapshot", {});

    expect(status).toBe(200);
    expect(envelope.ok).toBe(true);
    expect(envelope.data!.incident.id).toBe("INC-2107");
    expect(envelope.data!.incident.status).toBe("open");
    expect(envelope.data!.clock).toBe("14:32");
    expect(envelope.data!.scenarios.map((scenario) => scenario.id)).toEqual(["main"]);
    expect(fake.sessions.has(SESSION_ID)).toBe(true);
  });
});

describe("transport attribution", () => {
  it("attributes a webmcp-marked dispatch to the agent", async () => {
    const { call, fake } = createHost();
    await call("scenario.fork", { name: "Bypass", hypothesis: "skip the cache" }, {
      headers: { [CAPABILITY_TRANSPORT_HEADER]: "webmcp" },
    });

    const row = fake.ledger.find((entry) => entry.capability === "scenario.fork");
    expect(row?.actor).toBe("agent");
    expect(row?.transport).toBe("webmcp");
  });

  it("attributes an unmarked dispatch to the human", async () => {
    const { call, fake } = createHost();
    await call("scenario.fork", { name: "Bypass", hypothesis: "skip the cache" });

    const row = fake.ledger.find((entry) => entry.capability === "scenario.fork");
    expect(row?.actor).toBe("human");
    expect(row?.transport).toBe("http");
  });
});

describe("the destructive production switch", () => {
  let host: ReturnType<typeof createHost>;
  let proposalId: string;

  beforeEach(async () => {
    host = createHost();
    const forked = await host.call<{ result: string; scenario: { id: string } }>("scenario.fork", {
      name: "Bypass price cache",
      hypothesis: "Errors stop if cart pricing skips the new edge cache",
    });
    expect(forked.envelope.data!.result).toBe("ok");
    const scenarioId = forked.envelope.data!.scenario.id;

    const simulated = await host.call<{ result: string }>("scenario.simulate", {
      scenario: scenarioId,
      mitigation: "bypass_price_cache",
    });
    expect(simulated.envelope.data!.result).toBe("ok");

    const staged = await host.call<{ result: string; staged: { id: string } }>("mitigation.stage", {
      scenario: scenarioId,
      rationale: "Fastest recovery, reversible, moderate blast radius.",
      evidence: ["checkout_error_rate 14:05–14:32"],
    });
    expect(staged.envelope.data!.result).toBe("ok");
    proposalId = staged.envelope.data!.staged.id;
  });

  it("answers the first call with confirmation_required and a token", async () => {
    const { status, envelope } = await host.call("mitigation.apply", { proposal: proposalId });

    expect(status).toBe(409);
    expect(envelope.ok).toBe(false);
    expect(envelope.error?.code).toBe("confirmation_required");
    expect(typeof envelope.error?.confirmationToken).toBe("string");
    expect(envelope.error!.confirmationToken!.length).toBeGreaterThan(20);
    // Nothing was applied by the prepare call.
    const snapshot = await host.call<{ incident: { status: string; applied: unknown } }>(
      "incident.snapshot",
      {},
    );
    expect(snapshot.envelope.data!.incident.status).toBe("open");
    expect(snapshot.envelope.data!.incident.applied).toBeNull();
  });

  it("commits when the identical call carries the token", async () => {
    const prepared = await host.call("mitigation.apply", { proposal: proposalId });
    const token = prepared.envelope.error!.confirmationToken!;

    const committed = await host.call<{ result: string; incident: { status: string } }>(
      "mitigation.apply",
      { proposal: proposalId },
      { headers: { [CONFIRMATION_HEADER]: token } },
    );

    expect(committed.status).toBe(200);
    expect(committed.envelope.ok).toBe(true);
    expect(committed.envelope.data!.result).toBe("ok");
    expect(committed.envelope.data!.incident.status).toBe("recovered");

    const applyRow = host.fake.ledger.find((entry) => entry.capability === "mitigation.apply");
    expect(applyRow?.actor).toBe("human");
    expect(applyRow?.summary).toContain("APPLIED");
  });

  it("refuses a token bound to different input", async () => {
    const prepared = await host.call("mitigation.apply", { proposal: proposalId });
    const token = prepared.envelope.error!.confirmationToken!;

    const tampered = await host.call(
      "mitigation.apply",
      { proposal: "p-999" },
      { headers: { [CONFIRMATION_HEADER]: token } },
    );

    expect(tampered.envelope.ok).toBe(false);
    expect(tampered.status).toBeGreaterThanOrEqual(400);
    expect(tampered.envelope.error?.code).not.toBe("ok");
    // The incident is untouched.
    const snapshot = await host.call<{ incident: { status: string } }>("incident.snapshot", {});
    expect(snapshot.envelope.data!.incident.status).toBe("open");
  });
});

describe("incident.reset", () => {
  it("truncates the session back to the seed and clears its ledger", async () => {
    const { call, fake } = createHost();
    await call("scenario.fork", { name: "Bypass", hypothesis: "skip the cache" });
    expect(fake.ledger.length).toBeGreaterThan(0);

    const reset = await call<{ result: string }>("incident.reset", {});
    expect(reset.envelope.ok).toBe(true);
    expect(reset.envelope.data!.result).toBe("ok");

    const snapshot = await call<{ scenarios: { id: string }[]; ledger: unknown[] }>(
      "incident.snapshot",
      {},
    );
    expect(snapshot.envelope.data!.scenarios.map((scenario) => scenario.id)).toEqual(["main"]);
    // incident.snapshot logs itself, so the only row left is its own.
    expect(snapshot.envelope.data!.ledger.length).toBeLessThanOrEqual(1);
  });
});
