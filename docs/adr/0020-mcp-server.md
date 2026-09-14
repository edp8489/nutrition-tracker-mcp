# ADR 0020 — MCP server: TypeScript on Bun, stateless v1

Date: 2026-09-13
Status: Accepted

## Context
The product's highest-priority feature is interactive nutrition and recipe Q&A inside an LLM chat interface. Primary chat client: OpenWebUI (self-hosted). Alpaca and Unsloth Studio are best-effort targets whose MCP support is unverified — not claimed as supported. An earlier Python-backend assumption (FastMCP, pint, Chaquopy embedding on Android) was rejected: bundling a Python runtime in the Android APK adds heavy build complexity and risk, while a JavaScript runtime already exists in every consumer (browser, Capacitor WebView, Bun). The chat interface owns its own history; user data has no place on the server.

## Decision
Build the MCP server in **TypeScript on Bun** (Bun is the chosen runtime; no Node):
- **SDK**: `@modelcontextprotocol/sdk` — **streamable HTTP** transport (chat clients + personal web app), **stdio** where the SDK provides it.
- **Storage**: full OpenNutrition dataset in SQLite via `bun:sqlite` with an **FTS5** index (ADR-0025). Built by `scripts/build-sqlite.mjs` from the source TSV (ADR-0012, ADR-0023).
- **Serving**: the server process also serves the personal web app's built static files — one process, one command (ADR-0021).
- **Stateless v1**: no user-data endpoints. Logs, recipes, favorites, and chat history never reach the server. Recipe import/export (file-based JSON exchange) is a v2 feature, explicitly not sync.
- **Tool-design principles** (apply to every tool):
  1. All arithmetic is server-side. Summation, scaling, and unit conversion never happen in the model.
  2. `measured` semantics per ADR-0023 — the model can never assert "contains no X" from an unmeasured zero.
  3. Tool results carry `caveats` and phrasing guidance; dietary and health-adjacent answers are data-grounded statements with disclaimers, never advice.
  4. Dietary presets (keto, low-sodium, low-carb, high-protein) are server-defined thresholds — the model never invents criteria.
  5. Tool results embed dataset attribution metadata (ODbL, ADR-0008).
- **v1 tools**: `searchIngredient(query, filters)`, `getIngredientMacros(id, grams?, unit?)` (per-100g + normalized per-serving + `measured` flags), `computeRecipeMacros(ingredients[], servings)` — deterministic summation, the most important endpoint — `filterFoods(nutrient | dietPreset, min/max, category)` (nutrient ranges + dietary presets; gluten-free best-effort from `ingredient_analysis`), `convertUnits(quantity, from, to, foodId?)`.
- **v2 tools** (deferred, no ADR until designed): `suggestSubstitution` (DB-side nearest-neighbor on the nutrition vector), `recipe_generation` (ingredients chosen by code to hit target constraints; steps written by the LLM; macros stamped deterministically), `meal_plan`, recipe import/export.
- **Excluded**: amino-acid profile queries — data exists; the owner will never ask.

## Consequences
- One language (TypeScript) across server, shared tool library, and all app variants; one tool contract, three consumers (chat clients, personal web app via HTTP, Android in-process per ADR-0022).
- Phase-0 spike required: `@modelcontextprotocol/sdk` on Bun, `bun:sqlite` FTS5, and an OpenWebUI streamable-HTTP connection (PRD open items).
- The tool implementations live in `shared/` so the server is a thin transport wrapper; storage is consumed through a thin adapter (`bun:sqlite` server-side).