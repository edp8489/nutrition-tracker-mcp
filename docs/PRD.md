# PRD — Nutrition Tracker

**Status:** Revised — MCP pivot (supersedes "Ready for implementation", 2026-08-24)
**Date:** 2026-09-13
**Owner:** Eric
**Distribution:** MCP server + personal web app (local machine) · Android APK (sideloaded; embedded tool library + on-device SQLite) · External web app (static nginx, development deferred)

---

## 1. Overview

A personal-first calorie and macro tracker. The primary user is the owner; features and workflows reflect exact daily use cases driven by observed pain points, not speculative users. Uses the OpenNutrition dataset (v2025.1) as the food/nutrition source.

The product centers on an **MCP server** (ADR-0020): nutrition data and deterministic computation exposed as tools for LLM chat interfaces (interactive nutrition and recipe Q&A — OpenWebUI primary) and for the apps. One TypeScript tool contract, three consumers:

- **Personal web app** (ADR-0021) — runs on the local machine, served by the MCP server process; food data exclusively via MCP endpoints; user data in IndexedDB (Dexie).
- **Android app** (ADR-0022) — the same tool library compiled into the Capacitor bundle, called in-process; food data in on-device SQLite (subset seed + optional full-dataset download); user data in IndexedDB.
- **External web app** (ADR-0021) — the original static PWA (IndexedDB + bundled subset + chunked JSONL), development deferred.

The apps help the owner create custom recipes, log foods consumed during the day, and visualize macronutrient intake in tabular and graph form.

---

## 2. Product priorities

1. **MCP server** — LLM chat Q&A (OpenWebUI primary; Alpaca, Unsloth Studio best-effort)
2. **Personal web app** — local, MCP-backed
3. **Android app** — embedded tool library, on-device SQLite
4. **External web app** — static, development deferred

---

## 3. Goals

### 3.1 MCP server (priority 1)
1. **Interactive nutrition and recipe Q&A** in the owner's LLM chat interface, covering v1 task types: macro lookup, serving math, unit conversion, nutrient extremes/comparison, nutrient breakdown, dietary filtering.
2. **Deterministic, data-grounded answers** — all arithmetic server-side; unmeasured nutrients never reported as "contains none"; dietary and health-adjacent statements stay data-grounded with disclaimers.

### 3.2 Apps (priorities 2–4)
1. **Create and save custom recipes** — named ingredient lists with adjustable portion count; computed macros per portion.
2. **Log food consumed during the day** — freeform hourly entries referencing dataset foods or user recipes; past entries freely editable/deletable.
3. **See macronutrient breakdown** — per-entry, per-day, and per-week in both table and graph form. MVP macros: calories, protein, carbohydrates, fat.

---

## 4. Non-goals

- Full sync across devices — **by design**. Per-device data islands; recipe import/export (file-based, v2) is the only bridge (ADR-0009, ADR-0021).
- User data on the MCP server — stateless v1; chat history stays in the chat interface (ADR-0020).
- Amino-acid profile queries — excluded; data exists but the owner will never ask (ADR-0020).
- Vegan/vegetarian classification — not inferable from the dataset; dietary filtering stays data-grounded (ADR-0020).
- Embeddings in search v1 — phase 2 (ADR-0025).
- External web app development — deferred (ADR-0021).
- Desktop app — Wails preference dropped; the personal web app covers desktop (ADR-0021).
- Download/export of data (recipes and logs) — except v2 recipe import/export
- E2E encryption
- Minimal backend for sync
- Barcode camera scanning (numeric ID input only, deferred)
- Nested recipes (recipe-as-ingredient)
- Arbitrary date-range reports
- Multi-user / auth
- Push notifications
- Play Store listing (sideloaded APK, possible F-Droid later)

---

## 5. MCP server (ADR-0020)

### 5.1 Runtime
TypeScript on **Bun** (no Node); `@modelcontextprotocol/sdk`; **streamable HTTP** transport (chat clients + personal web app) and **stdio** (SDK-provided); food data in SQLite via `bun:sqlite` with an **FTS5** index (full dataset). The server process also serves the personal web app's static build — one process, one command.

### 5.2 Tools (v1)
| Tool | Purpose | Notes |
|------|---------|-------|
| `searchIngredient(query, filters)` | Hybrid search v1: FTS5 BM25 over weighted `name` + `altNames` + `labels` (lower weight: `description`, `ingredients`) | Aliases matter — "grilled chicken breast" must hit the cooked entry (ADR-0025) |
| `getIngredientMacros(id, grams?, unit?)` | Per-100g + normalized per-serving values | `measured` flags per ADR-0023 — the model can never assert "contains no X"; `caveats` array; ODbL attribution metadata |
| `computeRecipeMacros(ingredients[], servings)` | Deterministic summation of ingredient macros | **The most important endpoint** — summation must never happen in the model |
| `filterFoods(nutrient \| dietPreset, min/max, category)` | Nutrient-range filtering + dietary presets | Server-defined thresholds (keto, low_sodium, low_carb, high_protein) — the model never invents criteria; gluten-free best-effort from `ingredient_analysis` where tags exist (ADR-0023) |
| `convertUnits(quantity, from, to, foodId?)` | Unit conversion | js-quantities for pure units; household/count units via the food's `servingCommon` anchor (ADR-0024) |

### 5.3 Task types (v1)
- **macro_lookup** — "How much protein is in a 3-oz serving of grilled chicken breast?" → per-100g value × serving conversion.
- **serving_math** — "I ate 140 g of chicken breast. What were my macros?" → scale `nutrition100g` by 1.4.
- **unit_conversion** — ounces ↔ grams; "1 cup rice" via serving anchors.
- **nutrient_extremes/comparison** — pick k foods from a category (`labels`/`type`), rank by a nutrient. Grounded in data.
- **nutrient_breakdown** — "What are the main fats in chicken breast?" (saturated/mono/poly fractions; fatty acid composition).
- **label/dietary filtering** — "Which of these is keto-friendly / low-sodium?" — computed from fields (carbohydrates, sodium, fiber) with server-defined thresholds; disclaimers required; data-grounded statements only.

### 5.4 Design principles
1. All arithmetic is server-side. Summation, scaling, and unit conversion never happen in the model.
2. `measured` semantics per ADR-0023 — unmeasured zeros are reported as "not reported".
3. Tool results carry `caveats` and phrasing guidance; answers are data-grounded statements with disclaimers — never health advice.
4. Stateless v1 — no user data on the server; chat history stays in the chat interface.
5. Tool results embed dataset attribution (ODbL, ADR-0008).

### 5.5 v2 (deferred; no ADR until designed)
- `suggestSubstitution` — DB-side nearest-neighbor on the nutrition vector.
- `recipe_generation` — combine 3–8 foods; ingredients chosen by code to hit target constraints (e.g. "high-protein, ~40 g protein, <15 g fat"); steps written by the LLM; macros stamped deterministically.
- `meal_plan` — daily plan hitting macro targets; summed server-side.
- Recipe **import/export** — JSON file exchange between chat sessions and the apps (not sync).

---

## 6. Features (apps)

### 6.1 Food search
- Free-text search matching `name` OR any entry in `altNames` (case-insensitive).
- Personal web app: search executes via `searchIngredient` (MCP endpoint). Android: same tool in-process. External variant: local IndexedDB `includes()` search (existing behavior; deferred with the variant).
- Category filter via dataset `type` field: All / Everyday / Grocery / Prepared / Restaurant.
- Favorites shortcuts (separate `favorites` table).
- Recents shortcuts (separate `recents` table, capped at 50, updated on log/search).
- Results show: name, type, per-serving macros (4 MVP macros).

### 6.2 Recipes
- Create recipe: name + list of ingredients `{ foodId, quantity, unit }` + portion count.
- Quantity input accepts g, ml, oz, lb, fl oz, plus the food's common serving when defined; converted at save (js-quantities / serving anchors, ADR-0024); stored metric-only.
- No nested recipes (no recipe-as-ingredient).
- On save: `perPortionMacros = sum(ingredient macros ÷ 100g × quantity) ÷ portions` — computed by the shared `computeRecipeMacros` tool (MCP endpoint on personal web; in-process on Android); stored on recipe row.
- Edit recipe → recompute on save. Past log entries unaffected (frozen snapshot).
- Delete recipe → hard delete from recipe list. Past log entries unaffected.
- Recipe nutrition display: per-portion and total (× portions) for the 4 MVP macros.

### 6.3 Food log
- Freeform list of entries, each with a loose hourly timestamp (date + hour 0–23). No fixed meal slots.
- Entry types:
  - **Food entry**: `{ foodId, foodName, quantity, unit, timestamp, snapshotMacros }`.
  - **Recipe entry**: `{ recipeId, recipeName, portions, timestamp, snapshotMacrosPerPortion }`.
- Default timestamp = current hour; editable via `<input type="datetime-local">` rounded to hour.
- Default food quantity = `servingMetric.quantity` (common serving shown alongside); editable with the unit selector (ADR-0024); normalized to metric on save.
- Snapshot = per-portion (food) or per-portion (recipe) macros frozen at log time. Immutable.
- Free edit (quantity, timestamp) and delete of any past entry. Editing does not recompute snapshots.
- Log view: entries grouped by date, most-recent-date first; within a day, entries by hour ascending. Inline edit + delete per entry. "Add entry" per date.

### 6.4 Reports
- **Week view** (default): current Mon–Sun.
- **Stacked bar chart**: one bar per day, stacked by macro (protein/carbs/fat). Chart.js + vue-chartjs.
- **Daily totals table**: 7 rows, columns = calories, protein, carbs, fat.
- **Drill-down**: click a day → navigate to Log view filtered to that date.
- Day boundary = local calendar day, midnight-to-midnight. No offsets.
- Arbitrary date-range picker deferred.

### 6.5 PWA / offline (variant-scoped)
- **Personal web app**: served by the local MCP server; user data in IndexedDB (Dexie). No bundled dataset, no service worker requirement.
- **Android**: assets bundled in the app package; SQLite seeded from the bundled subset on first launch; fully functional offline after seeding; optional full-dataset chunk download (network needed once), imported into SQLite (ADR-0022). Service worker web-only (ADR-0019).
- **External web app (deferred)**: service worker caches app shell; dataset cached in IndexedDB after first load (bundled subset + chunked backend); installable PWA; `start_url`/`scope` = `/nutrition-tracker/` (ADR-0001, ADR-0013).
- No push notifications (all variants).

### 6.6 Attribution
- Persistent attribution footer on Recipes, Log, Reports views: "Data: [OpenNutrition](https://www.opennutrition.app)" + "(c) Open Food Facts contributors" link.
- About view with full ODbL + DbCL license text.
- MCP tool results embed attribution metadata (ADR-0008, ADR-0020).
- Attribution cannot be dismissed.

---

## 7. User stories

| ID  | As the user, I want to…                                                                  | So that…                                              |
|-----|-----------------------------------------------------------------------------------------|-------------------------------------------------------|
| US1 | search for a food by name or alternate name, filtered by category                       | I can find the ingredient I'm logging                 |
| US2 | mark foods as favorites and see recents                                                  | I can log common foods quickly                        |
| US3 | create a recipe by adding ingredients (food + quantity + unit) and setting portion count | I can compute and save macros per portion             |
| US4 | edit a recipe's ingredients or portion count                                             | I can adjust when I change how I cook it              |
| US5 | delete a recipe                                                                          | I can remove ones I no longer use                     |
| US6 | log a food entry at a loose hourly timestamp with a quantity (defaulting to its serving, in metric or household units) | I can record what I ate and when        |
| US7 | log a recipe entry as "N portions"                                                       | I can record meals cooked from my recipes             |
| US8 | edit or delete any past log entry                                                        | I can correct mistakes                                |
| US9 | view today's entries grouped by hour, with inline edit/delete                            | I can review and manage today's intake                |
| US10| view a week's macro breakdown as a stacked bar chart (Mon–Sun)                           | I can see trends in my intake                         |
| US11| view a daily totals table for the week                                                   | I can read exact numbers                              |
| US12| click a day in the chart to drill into that day's entries                                | I can inspect what made up a specific day             |
| US13| see data attribution to OpenNutrition on every data-displaying view                     | the ODbL license is respected                         |
| US14| ask my LLM chat interface nutrition and recipe questions grounded in the dataset          | I get deterministic, data-grounded answers            |

---

## 8. Architecture

### 8.1 Stack
| Layer        | Choice                                              | ADR      |
|--------------|-----------------------------------------------------|----------|
| Frontend     | Vue 3 (Composition API) + Vite + TypeScript         | ADR-0002 |
| UI framework | Naive UI (npm)                                      | ADR-0018 |
| State        | Pinia                                               | ADR-0002 |
| Routing      | Vue Router (`/recipes`, `/log`, `/reports`, `/about`) | ADR-0002 |
| Charts       | Chart.js + vue-chartjs                              | ADR-0007 |
| Persistence (user data) | IndexedDB via Dexie.js                    | ADR-0003 |
| Runtime      | Bun (no Node)                                       | ADR-0020 |
| MCP server   | TypeScript + `@modelcontextprotocol/sdk`            | ADR-0020 |
| MCP storage  | SQLite via `bun:sqlite` + FTS5                      | ADR-0020, ADR-0025 |
| Shared tool library | `shared/` workspace package (tools, units, measured semantics, types) | ADR-0020, ADR-0022 |
| Units        | js-quantities (frontend + server)                   | ADR-0024 |
| Dataset      | OpenNutrition v2025.1, full-column retention        | ADR-0004, ADR-0023 |
| Deploy       | Personal: local MCP process · External: nginx subpath (deferred) | ADR-0013, ADR-0021 |
| Mobile packaging | Capacitor (Android APK, sideloaded)             | ADR-0019, ADR-0022 |
| Tests        | Vitest                                              | —        |
| Lint         | ESLint + Prettier                                   | —        |

### 8.2 Dataset delivery (variant-scoped)
- **MCP server (personal + chat)**: full dataset (~326k rows, all columns) in one SQLite DB with FTS5 index, built from the source TSV by `scripts/build-sqlite.mjs` (ADR-0020, ADR-0023).
- **Android**: `everyday` subset (5,299 rows) seeds on-device SQLite at first launch; optional download of the remaining chunks (nginx-hosted JSONL, ADR-0011) imported into SQLite (ADR-0022).
- **External web app (deferred)**: build-time subset bundled at `dist/data/subset.jsonl` + chunked full dataset by first letter (`a.jsonl` … `_other.jsonl`, ~5k rows max per chunk) + `manifest.json`; lazy-fetched and cached in IndexedDB (ADR-0004, ADR-0011, ADR-0012). Unchanged from the original architecture.

### 8.3 Project structure (proposed)
```
nutrition-tracker/                  # bun workspaces: root = web app
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── sw.js                      # service worker (external variant)
├── src/                           # Vue app (structure unchanged)
│   ├── views/ (Recipes, Log, Reports, About)
│   ├── components/ (FoodSearch, RecipeEditor, LogEntry, MacroTable, MacroChart, AttributionFooter)
│   ├── stores/ (foods, recipes, log, dataset)
│   ├── db/ (dexie.ts)
│   ├── router/ · types/ · utils/
├── shared/                        # MCP tool library (workspace package)
│   ├── tools/                     # searchIngredient, getIngredientMacros, computeRecipeMacros, filterFoods, convertUnits
│   ├── units.ts                   # js-quantities + serving anchors (ADR-0024)
│   ├── measured.ts                # measured tier map + semantics (ADR-0023)
│   └── types.ts                   # Food, Recipe, LogEntry, Macros, tool contracts
├── server/                        # MCP server (workspace package)
│   ├── index.ts                   # streamable HTTP + stdio transports; static mount for personal web app
│   └── db.ts                      # bun:sqlite connection + schema + FTS5
├── scripts/
│   ├── build-subset.mjs           # full-column projection + servingCommon + measured-zero fix (ADR-0023)
│   └── build-sqlite.mjs           # TSV → SQLite + FTS5 index (ADR-0020)
├── android/                       # Capacitor project
├── docs/
│   ├── PRD.md                     # this file
│   ├── glossary.md
│   └── adr/                       # 0001–0025
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 9. Data model

### 9.1 Food rows (SQLite for MCP/Android; IndexedDB for external variant)
Projected row per ADR-0023 — **all 13 source TSV columns retained**:
`id`, `name`, `altNames`, `description`, `type`, `source`, `servingMetric` (`serving.metric`), `servingCommon` (`serving.common`), `nutrition100g`, `ean13`, `labels`, `package_size`, `ingredients`, `ingredient_analysis`.

- `nutrition100g`: full ~90-field blob; absent fields = `null` (unmeasured), never fabricated zeros (ADR-0023).
- `servingCommon`: `{ unit, quantity }` household serving (e.g. `{ unit: "cup", quantity: 1 }` = 160 g cooked rice); anchor for household-unit conversion (ADR-0024).
- `labels` are preparation states (cooked, raw, salted, …), **not** dietary classifications (ADR-0016); dietary filtering computes from nutrient fields (ADR-0020).

### 9.2 IndexedDB tables (Dexie — user data, all variants)

**`recipes`**
| Field              | Type     | Notes                                          |
|--------------------|----------|------------------------------------------------|
| `id`               | string   | PK (uuid)                                      |
| `name`             | string   |                                                |
| `ingredients`      | `{ foodId, quantity, unit }[]` | Metric-normalized (ADR-0024)      |
| `portions`         | number   | User-defined                                   |
| `perPortionMacros` | `{ calories, protein, carbs, fat }` | Computed on save via `computeRecipeMacros` |
| `createdAt` / `updatedAt` | ISOString |                                       |

**`logEntries`**
| Field           | Type     | Notes                                              |
|-----------------|----------|----------------------------------------------------|
| `id`            | string   | PK (uuid)                                          |
| `timestamp`     | ISOString | Hour precision (date + hour 0–23)                 |
| `kind`          | `'food'\|'recipe'` |                                          |
| `foodRef`       | `{ foodId, foodName, quantity, unit }` | Present if kind=food; metric-normalized |
| `recipeRef`     | `{ recipeId, recipeName, portions }` | Present if kind=recipe           |
| `snapshotMacros`| `{ calories, protein, carbs, fat }` | Per-unit (food) or per-portion (recipe), frozen at log time |
| `createdAt`     | ISOString |                                                   |

**`favorites`** — `{ foodId (PK), addedAt }`.
**`recents`** — `{ foodId (PK), lastUsedAt }`, evict oldest beyond 50.

### 9.3 Macro computation
- Computation lives in the shared tool library; the personal web app calls it via the MCP endpoint, Android in-process.
- **Food entry macros** = `nutrition100g.{calories,protein,total_fat,carbohydrates} × (quantity / 100)`.
- **Recipe per-portion macros** = `Σ(food macros per ingredient) ÷ portions`.
- **Recipe entry macros** = `perPortionMacros × portionsLogged`.
- **Day totals** = `Σ(entry macros)` for all entries with `timestamp` date = target day (local).
- **Measured semantics** (ADR-0023): `measured: false` fields are reported as "not reported", never as "contains none".

### 9.4 Frozen snapshot rule (ADR-0005)
At log time, copy the computed macros into `snapshotMacros`. Editing or deleting the source food/recipe never mutates existing log entries. Reports read from `snapshotMacros` only.

---

## 10. UI/UX flows

### 10.1 Views
| Route                  | View          | Purpose                                              |
|------------------------|---------------|------------------------------------------------------|
| `/recipes`             | RecipesView   | List, create, edit, delete recipes                   |
| `/log`                 | LogView       | View/add/edit/delete log entries; supports `?date=`  |
| `/reports`             | ReportsView   | Week chart + daily totals table; click → Log drill   |
| `/about`               | AboutView     | Attribution + license text                           |

Chat-based Q&A flows (task types, §5.3) happen in the LLM chat interface, not the app UI.

### 10.2 Key flows

**Log a food:**
1. Log view → "Add entry" on today's date.
2. FoodSearch component → type query → filter by category (`searchIngredient`) → select food.
3. Quantity pre-filled from `servingMetric.quantity`; unit selector offers g, ml, oz, lb, fl oz, and the food's common serving (ADR-0024); normalized to metric on save.
4. Timestamp defaults to current hour; edit if needed.
5. Save → entry written with frozen `snapshotMacros`; recents table updated.

**Log a recipe:**
1. Log view → "Add entry".
2. FoodSearch (or a recipe picker tab) → select recipe.
3. Portions input (default 1).
4. Timestamp + save. Snapshot = recipe's `perPortionMacros` frozen.

**Create a recipe:**
1. Recipes view → "New recipe".
2. Name field + portion count field.
3. Add ingredients via FoodSearch (food + quantity + unit per line; unit selector as above).
4. Save → `perPortionMacros` computed via `computeRecipeMacros` and stored.

**View reports:**
1. Reports view → current week (Mon–Sun) loads.
2. Stacked bar chart renders (protein/carbs/fat per day).
3. Daily totals table below.
4. Click a day bar → navigate to `/log?date=YYYY-MM-DD`.

**Chat Q&A (OpenWebUI):**
1. Owner asks a natural-language nutrition/recipe question in the chat interface.
2. The LLM host calls MCP tools (`searchIngredient` → `getIngredientMacros` / `computeRecipeMacros` / `filterFoods` / `convertUnits`).
3. Server performs all arithmetic and returns values + `measured` flags + `caveats`.
4. The model phrases a data-grounded answer with disclaimers and attribution.

---

## 11. Technical decisions (ADR index)

| ADR    | Title                                            |
|--------|--------------------------------------------------|
| 0001   | Static PWA architecture (now external-variant-scoped) |
| 0002   | Frontend stack: Vue 3 + Vite + TS + beerCSS + Pinia |
| 0003   | IndexedDB via Dexie.js                            |
| 0004   | Dataset delivery: hybrid (subset + chunked)       |
| 0005   | Frozen nutrition snapshot at log time             |
| 0006   | Metric units only (g/ml)                          |
| 0007   | Chart.js + vue-chartjs                            |
| 0008   | ODbL attribution + derivative dataset handling    |
| 0009   | Single-user, single-device for MVP                |
| 0010   | Freeform hourly log entries (no meal slots)        |
| 0011   | Dataset chunks: JSONL by first letter              |
| 0012   | Build-time subset: generic foods + frequency tool  |
| 0013   | Deploy path: `/nutrition-tracker/` subpath         |
| 0014   | Favorites and Recents as separate tables           |
| 0015   | Stored food schema (projected columns)             |
| 0016   | Category taxonomy from `type` field                |
| 0017   | Attribution on every data-displaying view          |
| 0018   | UI framework: Naive UI (replaces BeerCSS)          |
| 0019   | Capacitor for Android; desktop deferred (Wails)    |
| 0020   | MCP server: TypeScript on Bun, stateless v1        |
| 0021   | App variants: Personal (MCP-backed) / External (static) |
| 0022   | Android: embedded MCP tool library + on-device SQLite |
| 0023   | Stored schema: full-column retention + measured-value semantics |
| 0024   | Unit handling: metric storage, imperial/household input |
| 0025   | Hybrid search: FTS5 BM25 first, local embeddings later |

---

## 12. Dataset facts (OpenNutrition v2025.1)

| Metric            | Value                          |
|-------------------|--------------------------------|
| Total rows        | 326,759                        |
| TSV size          | 282 MB (uncompressed)          |
| Columns           | 13 (all retained, ADR-0023)    |
| `everyday`        | 5,299 rows (13.1 MB TSV)       |
| `grocery`         | 313,442 rows (236.9 MB, all w/ EAN-13) |
| `prepared`        | 3,836 rows (9.3 MB)            |
| `restaurant`      | 4,182 rows (9.7 MB)            |
| MVP subset        | `everyday` → Android seed + external variant bundle |
| `nutrition_100g`  | ~90 sub-fields per row (full blob stored; unmeasured stored as explicit `0` in source — see ADR-0023) |
| `serving`         | `common` (household, e.g. "1 cup") + `metric` (g/ml) — both retained (ADR-0023) |
| `labels`          | Preparation states (cooked, raw, salted, …) — not dietary (ADR-0016) |
| License           | ODbL + DbCL                    |

---

## 13. Build & deploy

- **Dataset**: `bun scripts/build-sqlite.mjs` → `opennutrition.sqlite` (full dataset, FTS5 index) for the MCP server. `bun scripts/build-subset.mjs` → subset + chunks + manifest (external variant bundle; Android seed + optional download).
- **MCP server + personal web app**: `bun run build` (Vite emits `dist/`) → `bun run server` — one Bun process serving the streamable-HTTP API and the built app. Development: `bun run dev` (Vite) with the MCP endpoints proxied to the local server.
- **Android build**: Vite build with `base: '/'` + hash router, bundle the `everyday` subset → `npx cap sync android` → APK via Android Studio/Gradle. Sideload only (ADR-0019). First launch seeds on-device SQLite from the subset; optional "download full dataset" imports the remaining chunks into SQLite (ADR-0022).
- **External web app (deferred)**: unchanged — copy `dist/` to nginx per ADR-0013; `VITE_CHUNK_BASE` points Android/web at the hosted data path.

---

## 14. Open items (none blocking the MCP server)

- **Phase-0 spikes** (before implementation):
  1. `@modelcontextprotocol/sdk` on Bun + `bun:sqlite` FTS5 + OpenWebUI streamable-HTTP connection (ADR-0020) — **verified 2026-09-14** (`bun run server/smoke.ts stdio|http`): SDK 1.30 runs on Bun via the web-standard transport; stateless mode requires a fresh server+transport per request; "grilled chicken breast" ranks the cooked everyday entry top (tool-layer everyday boost); live OpenWebUI connection confirmed by the owner (model successfully called the tool).
  2. Android WebView SQLite mechanism (`@capacitor-community/sqlite` vs SQLite WASM/OPFS) + FTS5 availability (ADR-0022) — open.
- `build-subset.mjs` rework: full-column retention, `servingCommon`, measured-zero fix (ADR-0023); new `build-sqlite.mjs` (ADR-0020).
- Measured tier map curation (ADR-0023) — which fields are "reliably measured".
- Embeddings phase 2 (ADR-0025): nomic-embed-text-v1.5 or Snowflake arctic-embed, local inference, sqlite-vec.
- v2 MCP tools (`suggestSubstitution`, `recipe_generation`, `meal_plan`) + recipe import/export — no ADR until designed.
- External web app development (deferred, ADR-0021).
- Legal review of ODbL terms before any public release.
- F-Droid distribution: requires an app-code license decision + reproducible builds.