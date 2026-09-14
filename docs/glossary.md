# Glossary — Nutrition Tracker

| Term        | Definition                                                                                          |
|-------------|-----------------------------------------------------------------------------------------------------|
| Food        | A single ingredient row from the OpenNutrition dataset. Identified by dataset id.                  |
| Recipe      | A named list of ingredients (foods + quantity + unit) with a user-defined portion count. No nested recipes in MVP. |
| Ingredient  | One line of a recipe: `{ foodRef, quantity, unit }`. Metric-normalized at save (ADR-0024).          |
| Portion     | User-defined count of servings a recipe yields. Recipe nutrition = sum of ingredients ÷ portions.  |
| Log Entry   | A record of consumption at a loose timestamp (date + hour). References a food or a recipe and stores a frozen macro snapshot. |
| Snapshot    | Per-portion macro values (kcal, protein, carbs, fat) copied into a log entry at creation time. Immutable. |
| Macros      | The four MVP macronutrients: calories (kcal), protein (g), carbohydrates (g), fat (g).              |
| Category    | A coarse classification filter on foods via the dataset `type` field (everyday / grocery / prepared / restaurant). `labels` are preparation states (cooked, raw, salted, …), not dietary classifications. |
| Favorite    | A user-flagged food for quick access in search. Stored as a flag/shortlist.                         |
| Recent      | A food or recipe recently logged or searched, surfaced as a shortcut.                               |
| Dataset     | The OpenNutrition foods dataset (~111MB zip, 282MB uncompressed TSV). Delivered as full SQLite (MCP server, ADR-0020) and hybrid subset + chunks (external variant; Android seed/download). |
| Subset      | The slimmed build-time set of common/generic foods (`everyday`, 5,299 rows). Seeds Android's on-device SQLite (ADR-0022); bundles in the external variant for first-paint usability. |
| Chunk       | A static JSONL file on the nginx backend holding a slice of the parsed dataset, fetched by the external web app (into IndexedDB) and by Android's optional full-dataset download (imported into SQLite). |
| Day         | A local calendar day (no timezone gymnastics). Used for report aggregation.                          |
| Hour        | Loose timestamp precision: date + hour-of-day (0–23). Minutes/seconds not captured.                 |
| Naive UI    | Vue 3 component library replacing BeerCSS (ADR-0018). Light theme default; dark toggle in preferences. |
| Capacitor   | Native runtime wrapping the web build as an Android app (ADR-0019). Hosts the embedded MCP tool library and on-device SQLite (ADR-0022). |
| Data Island | An independent per-install data store (IndexedDB). Intentional by design (ADR-0009, ADR-0021): no sync planned; recipe import/export (v2) is the only bridge. |
| F-Droid     | FOSS Android app repository. Possible future distribution channel pending app-code licensing.        |
| MCP         | Model Context Protocol — open protocol connecting LLM applications to tools and data. The server exposes typed tools; a host LLM calls them. |
| MCP Server  | The TypeScript-on-Bun process (ADR-0020) exposing nutrition tools via streamable HTTP / stdio. Also serves the personal web app's static build. Stateless v1 — no user data. |
| Tool        | A typed, named operation exposed via MCP (e.g. `computeRecipeMacros`). All arithmetic lives in tools, never in the model. |
| Task Type   | A class of chat queries answered by tool combinations (ADR-0020 v1): macro_lookup, serving_math, unit_conversion, nutrient_extremes/comparison, nutrient_breakdown, label/dietary filtering. |
| Tool Library| The `shared/` TypeScript package implementing the MCP tools. Consumed in-process by Android (ADR-0022); wrapped with HTTP transports by the MCP server. |
| Personal Web App | Local web variant served by the MCP server process; food data via MCP endpoints; user data in IndexedDB. Priority 2 (ADR-0021). |
| External Web App | Static nginx-hosted variant; IndexedDB + bundled subset + chunked JSONL. Fully offline after first load. Development deferred. Priority 4 (ADR-0021). |
| Common Serving | A food's household serving from `serving.common` (e.g. "1 cup" cooked rice = 160 g; "1 large egg" = 50 g). Anchor for household-unit conversion (ADR-0024). |
| Measured vs Unmeasured | Distinguishes an analyzed value from "not analyzed". The source stores unmeasured nutrients as explicit `0`; out-of-tier zeros are served with `measured: false` so answers say "not reported", never "contains none" (ADR-0023). |
| Hybrid Search | BM25 keyword search plus (phase 2) local open-weights embeddings, merged. v1 ships FTS5 BM25 only (ADR-0025). |
| Data-Grounded Statement | An answer stating only what dataset fields support, with caveats/disclaimers; the required phrasing style for MCP answers and dietary filtering (ADR-0020). |
| Bun         | JavaScript runtime used across the project (no Node): web tooling, the MCP server process, and workspaces (ADR-0020). |