import { defineApp, route } from "@pracht/core";

export const app = defineApp({
  shells: {
    app: "./shells/app.tsx",
  },
  middleware: {
    session: "./middleware/session.ts",
  },
  capabilities: {
    "incident.snapshot": () => import("./capabilities/incident-snapshot.ts"),
    "signals.query": () => import("./capabilities/signals-query.ts"),
    "scenario.fork": () => import("./capabilities/scenario-fork.ts"),
    "scenario.simulate": () => import("./capabilities/scenario-simulate.ts"),
    "scenario.compare": () => import("./capabilities/scenario-compare.ts"),
    "mitigation.stage": () => import("./capabilities/mitigation-stage.ts"),
    "mitigation.apply": () => import("./capabilities/mitigation-apply.ts"),
    "incident.reset": () => import("./capabilities/incident-reset.ts"),
  },
  agents: {
    confirmation: { ttlSeconds: 120 },
  },
  routes: [
    route("/", "./routes/incident.tsx", {
      id: "incident",
      render: "ssr",
      shell: "app",
      middleware: ["session"],
    }),
  ],
  notFound: {
    component: "./routes/not-found.tsx",
    shell: "app",
  },
});
