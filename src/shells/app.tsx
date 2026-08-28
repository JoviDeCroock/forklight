import type { ShellProps } from "@pracht/core";
import { publicEnv } from "@pracht/core";
import "../styles/global.css";

export function Shell({ children }: ShellProps) {
  return <div class="min-h-screen bg-zinc-950 text-zinc-200 antialiased">{children}</div>;
}

export function head() {
  const meta: Record<string, string>[] = [
    { content: "width=device-width, initial-scale=1", name: "viewport" },
    {
      name: "description",
      content:
        "Forklight — rehearse the fix before shipping it. An agent-native incident-response canvas: agents investigate and stage, humans hold the production switch.",
    },
  ];
  // Stable Chrome/Edge only expose document.modelContext during the WebMCP
  // origin trial when the page carries a token; agent-embedded browsers (the
  // ChatGPT desktop browser) enable the API themselves.
  const otToken = publicEnv.PRACHT_PUBLIC_WEBMCP_OT_TOKEN;
  if (otToken) meta.push({ "http-equiv": "origin-trial", content: otToken });
  return {
    title: "Forklight — rehearse the fix before shipping it",
    meta,
  };
}
