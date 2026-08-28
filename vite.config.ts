import { defineConfig } from "vite";
import { pracht } from "@pracht/vite-plugin";
import { cloudflareAdapter } from "@pracht/adapter-cloudflare";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [pracht({ adapter: cloudflareAdapter(), llmsTxt: {} }), tailwindcss()],
});
