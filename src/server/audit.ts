// Structured audit log: one line per capability dispatch, on every transport.
// The in-app activity ledger is the product surface; this is the ops surface.
import { addCapabilityAuditListener } from "@pracht/core/server";

const stop = addCapabilityAuditListener("audit-log", (event) => {
  console.log(
    JSON.stringify({
      msg: "capability",
      capability: event.capability,
      effect: event.effect,
      transport: event.transport,
      via: event.via,
      outcome: event.outcome,
      status: event.status,
      durationMs: Math.round(event.durationMs),
    }),
  );
});

if (import.meta.hot) {
  import.meta.hot.dispose(stop);
}
