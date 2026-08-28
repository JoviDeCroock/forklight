import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOW,
  HORIZON,
  MITIGATIONS,
  assessScenario,
  logLines,
  metricAt,
  minuteToClock,
  seedState,
  series,
  type MitigationId,
  type Scenario,
  type SessionState,
} from "../../src/server/incident.ts";

function scenarioWith(mitigation: MitigationId, atMinute = DEFAULT_NOW): {
  state: SessionState;
  scenario: Scenario;
} {
  const state = seedState();
  const scenario: Scenario = {
    id: "s-1",
    name: `What if: ${mitigation}`,
    parent: "main",
    hypothesis: "test",
    actions: [{ mitigation, atMinute }],
  };
  state.scenarios.push(scenario);
  return { state, scenario };
}

describe("the incident engine is deterministic", () => {
  it("returns identical metric values for identical calls", () => {
    expect(metricAt("web_error_rate", 62, [])).toEqual(metricAt("web_error_rate", 62, []));
    expect(metricAt("db_cpu", 47, [{ mitigation: "rollback_deploy", atMinute: 40 }])).toEqual(
      metricAt("db_cpu", 47, [{ mitigation: "rollback_deploy", atMinute: 40 }]),
    );
  });

  it("returns deep-equal series and assessments across repeated calls", () => {
    const actions = [{ mitigation: "bypass_response_cache" as const, atMinute: DEFAULT_NOW }];
    expect(series("web_error_rate", actions, 30, HORIZON)).toEqual(
      series("web_error_rate", actions, 30, HORIZON),
    );

    const first = scenarioWith("bypass_response_cache");
    const second = scenarioWith("bypass_response_cache");
    expect(assessScenario(first.state, first.scenario)).toEqual(
      assessScenario(second.state, second.scenario),
    );

    expect(logLines("web", 30, 62)).toEqual(logLines("web", 30, 62));
  });

  it("holds the golden values the seeded narrative is built on", () => {
    // Frozen clock: 14:32 is minute 62 since 13:30.
    expect(DEFAULT_NOW).toBe(62);
    expect(minuteToClock(DEFAULT_NOW)).toBe("14:32");

    // A refactor that shifts the incident shape has to change these numbers,
    // which is the point: the demo, the video and the evals all assume them.
    expect(metricAt("web_error_rate", 62, [])).toBe(18.33);
    expect(metricAt("web_p95_ms", 62, [])).toBe(1798.93);
    expect(metricAt("cache_hit_ratio", 62, [])).toBe(40.21);
    expect(metricAt("requests_per_min", 62, [])).toBe(63.57);
    expect(metricAt("db_cpu", 62, [])).toBe(51.75);

    // Pre-incident (minute 34 = 14:04, one minute before the deploy) the
    // error rate is still ~baseline.
    expect(metricAt("web_error_rate", 34, [])).toBe(1.21);
    expect(metricAt("cache_hit_ratio", 34, [])).toBe(94);
  });

  it("puts a user-controlled prompt-injection string in the web logs", () => {
    // The reason signals.query advertises untrustedContentHint.
    const lines = logLines("web", 30, 62);
    expect(lines.some((line) => line.includes("ignore all previous instructions"))).toBe(true);
    expect(lines.some((line) => line.includes("RevisionMismatchError"))).toBe(true);
  });
});

describe("mitigations behave as the catalog claims", () => {
  it("bypass_response_cache reaches recovery inside the forecast window", () => {
    const { state, scenario } = scenarioWith("bypass_response_cache");
    const assessment = assessScenario(state, scenario);

    expect(assessment.recoveryEtaMinutes).not.toBeNull();
    expect(assessment.recoveryEtaMinutes).toBe(4);
    expect(assessment.recoveryAtClock).toBe("14:36");
    expect(assessment.confidence).toBe(MITIGATIONS.bypass_response_cache.confidence);
    expect(assessment.blastRadius?.level).toBe("moderate");
  });

  it("rollback_deploy also recovers, but slower", () => {
    const bypass = scenarioWith("bypass_response_cache");
    const rollback = scenarioWith("rollback_deploy");
    const fast = assessScenario(bypass.state, bypass.scenario).recoveryEtaMinutes;
    const slow = assessScenario(rollback.state, rollback.scenario).recoveryEtaMinutes;

    expect(fast).not.toBeNull();
    expect(slow).not.toBeNull();
    expect(slow!).toBeGreaterThan(fast!);
  });

  it("scale_web never recovers — the failure is not load-shaped", () => {
    const { state, scenario } = scenarioWith("scale_web");
    const assessment = assessScenario(state, scenario);

    expect(assessment.recoveryEtaMinutes).toBeNull();
    expect(assessment.recoveryAtClock).toBeNull();
  });

  it("purge_edge_cache does not recover within the horizon", () => {
    const { state, scenario } = scenarioWith("purge_edge_cache");
    const assessment = assessScenario(state, scenario);

    expect(assessment.recoveryEtaMinutes).toBeNull();
    // It dips, but never below the 1% recovery threshold: the fragmented
    // cache:v2 keys repopulate with the same bug.
    const lowest = Math.min(
      ...Array.from({ length: HORIZON - DEFAULT_NOW + 1 }, (_unused, index) =>
        metricAt("web_error_rate", DEFAULT_NOW + index, scenario.actions),
      ),
    );
    expect(lowest).toBeGreaterThan(1);
    expect(lowest).toBeLessThan(metricAt("web_error_rate", DEFAULT_NOW, []));
  });

  it("ranks the honest decoys below the real fixes on requests lost", () => {
    const lost = (mitigation: MitigationId) => {
      const { state, scenario } = scenarioWith(mitigation);
      return assessScenario(state, scenario).requestsLostPerMinute;
    };

    expect(lost("bypass_response_cache")).toBeLessThan(lost("scale_web"));
    expect(lost("bypass_response_cache")).toBeLessThan(lost("purge_edge_cache"));
  });
});
