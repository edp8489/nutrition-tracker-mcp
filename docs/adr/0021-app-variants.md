# ADR 0021 — App variants: Personal (MCP-backed) and External (static)

Date: 2026-09-13
Status: Accepted — amends ADR-0001, ADR-0004, ADR-0013

## Context
The MCP server (ADR-0020) is the priority-1 component and runs on the owner's local machine, serving an LLM chat interface. A public static web app cannot reach that server; conversely the MCP server is not publicly hosted. The web app therefore ships as two variants with different data paths. Priorities: MCP → personal web app → Android (ADR-0022) → external web app.

## Decision
Ship two web variants from the same Vue codebase:
- **Personal web app** (priority 2): runs on the owner's local machine. Served as static files **by the MCP server process** — one Bun process serves the streamable-HTTP API and the built web app. Food data comes exclusively from MCP endpoints (`searchIngredient`, `getIngredientMacros`, `computeRecipeMacros`, `filterFoods`, `convertUnits`). **No bundled dataset**: no `subset.jsonl`, no chunk fetches. User data (logs, recipes, favorites, recents) stays in IndexedDB via Dexie (ADR-0003). `vite dev` is used only for development, proxying MCP endpoints.
- **External web app** (priority 4): the original static architecture (ADR-0001, ADR-0004, ADR-0011, ADR-0013) — static hosting on the personal nginx subpath, IndexedDB + bundled subset + chunked JSONL backend, fully offline after first load. **Development is deferred** until the other priorities ship.
- Desktop is covered by the personal web app in a browser; the Wails preference from ADR-0019 is dropped.

## Consequences
- ADR-0001's static-PWA architecture now describes the external variant only.
- Chunked JSONL delivery (ADR-0004, ADR-0011) is scoped to the external variant and to Android's optional full-dataset download (ADR-0022).
- The nginx subpath deployment (ADR-0013) applies to the external variant; the personal app is served locally by the MCP server.
- Per-device data islands remain **by design** (ADR-0009): user data is per-device, no sync planned; recipe import/export (v2) is the only bridge.