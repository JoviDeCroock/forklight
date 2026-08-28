# forklight

This pracht starter is configured for Cloudflare Workers.

## Commands

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm preview`
- `pnpm deploy`

Edit `wrangler.jsonc` to add KV, D1, R2, cron triggers, or other Cloudflare bindings.

## Files

- `src/routes.ts` defines your app manifest.
- `src/routes/home.tsx` is the first page.
- `src/routes/not-found.tsx` is the not-found page, wired via `notFound`.
- `src/api/health.ts` is a sample API route.
- `pnpm-workspace.yaml#allowBuilds` allows only the dependency build scripts required by this starter.
- `src/styles/global.css` is the Tailwind CSS entry, imported by the shell.
- `.claude/skills/` and `.mcp.json` wire up the pracht Claude Code skills and MCP server.

## Checks

- `pracht verify` validates routes and constraints.
- `pracht plan --write` commits an app-graph snapshot to `.pracht/`; `pracht plan` diffs against it.
- `pracht report` prints a PR-ready summary of both.
