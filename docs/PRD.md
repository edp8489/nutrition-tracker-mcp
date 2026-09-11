# PRD — Nutrition Tracker

**Status:** Ready for implementation
**Date:** 2026-08-24
**Owner:** Eric
**Deploy targets:** Web — personal nginx server, `/nutrition-tracker/` subpath; Android — sideloaded Capacitor APK (ADR-0019)

---

## 1. Overview

A web-based calorie and macro tracker with minimal UI. Uses the OpenNutrition dataset (v2025.1) as the food/nutrition source. Built as a static PWA — fully offline-capable after first load. Single-user, single-device for MVP; sync and identity explicitly deferred. Distributed as a web PWA plus an Android app via Capacitor (ADR-0019); a desktop app (Wails) is deferred.

The app helps the owner (primary user) create custom recipes, log foods consumed during the day, and visualize macronutrient intake in tabular and graph form.

---

## 2. Goals (MVP)

1. **Create and save custom recipes** — named ingredient lists with adjustable portion count; computed macros per portion.
2. **Log food consumed during the day** — freeform hourly entries referencing dataset foods or user recipes; past entries freely editable/deletable.
3. **See macronutrient breakdown** — per-entry, per-day, and per-week in both table and graph form. MVP macros: calories, protein, carbohydrates, fat.

---

## 3. Non-goals (deferred from MVP)

- Download/export of data (recipes and logs)
- Sync across devices
- E2E encryption
- Minimal backend for sync
- Barcode camera scanning (numeric ID input only, deferred)
- Imperial unit conversion
- Micronutrient display (schema stores full `nutrition_100g`, UI shows 4 macros only)
- Nested recipes (recipe-as-ingredient)
- Arbitrary date-range reports
- Multi-user / auth
- Push notifications
- Desktop app (Wails) — deferred until after the Android app ships
- Play Store listing (sideloaded APK, possible F-Droid later)

---

## 4. User stories

| ID  | As the user, I want to…                                                                  | So that…                                              |
|-----|-----------------------------------------------------------------------------------------|-------------------------------------------------------|
| US1 | search for a food by name or alternate name, filtered by category                       | I can find the ingredient I'm logging                 |
| US2 | mark foods as favorites and see recents                                                  | I can log common foods quickly                        |
| US3 | create a recipe by adding ingredients (food + quantity + unit) and setting portion count | I can compute and save macros per portion             |
| US4 | edit a recipe's ingredients or portion count                                             | I can adjust when I change how I cook it              |
| US5 | delete a recipe                                                                          | I can remove ones I no longer use                     |
| US6 | log a food entry at a loose hourly timestamp with a quantity (defaulting to its serving) | I can record what I ate and when                      |
| US7 | log a recipe entry as "N portions"                                                       | I can record meals cooked from my recipes             |
| US8 | edit or delete any past log entry                                                        | I can correct mistakes                                |
| US9 | view today's entries grouped by hour, with inline edit/delete                            | I can review and manage today's intake                |
| US10| view a week's macro breakdown as a stacked bar chart (Mon–Sun)                           | I can see trends in my intake                         |
| US11| view a daily totals table for the week                                                   | I can read exact numbers                              |
| US12| click a day in the chart to drill into that day's entries                                | I can inspect what made up a specific day             |
| US13| see data attribution to OpenNutrition on every data-displaying view                      | the ODbL license is respected                         |

---

## 5. Features

### 5.1 Food search
- Free-text search matching `name` OR any entry in `altNames` (case-insensitive `includes()`).
- Category filter via dataset `type` field: All / Everyday / Grocery / Prepared / Restaurant.
- Favorites shortcuts (separate `favorites` table).
- Recents shortcuts (separate `recents` table, capped at 50, updated on log/search).
- Results show: name, type, per-serving macros (4 MVP macros).

### 5.2 Recipes
- Create recipe: name + list of ingredients `{ foodId, quantity, unit: 'g'|'ml' }` + portion count.
- No nested recipes (no recipe-as-ingredient).
- On save: compute `perPortionMacros = sum(ingredient macros ÷ 100g × quantity) ÷ portions`; store on recipe row.
- Edit recipe → recompute on save. Past log entries unaffected (frozen snapshot).
- Delete recipe → hard delete from recipe list. Past log entries unaffected.
- Recipe nutrition display: per-portion and total (× portions) for the 4 MVP macros.

### 5.3 Food log
- Freeform list of entries, each with a loose hourly timestamp (date + hour 0–23).
- No fixed meal slots.
- Entry types:
  - **Food entry**: `{ foodId, foodName, quantity, unit, timestamp, snapshotMacros }`.
  - **Recipe entry**: `{ recipeId, recipeName, portions, timestamp, snapshotMacrosPerPortion }`.
- Default timestamp = current hour; editable via `<input type="datetime-local">` rounded to hour.
- Default food quantity = `servingMetric.quantity`; editable.
- Snapshot = per-portion (food) or per-portion (recipe) macros frozen at log time. Immutable.
- Free edit (quantity, timestamp) and delete of any past entry. Editing does not recompute snapshots.
- Log view: entries grouped by date, most-recent-date first; within a day, entries by hour ascending. Inline edit + delete per entry. "Add entry" per date.

### 5.4 Reports
- **Week view** (default): current Mon–Sun.
- **Stacked bar chart**: one bar per day, stacked by macro (protein/carbs/fat). Chart.js + vue-chartjs.
- **Daily totals table**: 7 rows (one per day), columns = calories, protein, carbs, fat.
- **Drill-down**: click a day → navigate to Log view filtered to that date.
- Day boundary = local calendar day, midnight-to-midnight. No offsets.
- Arbitrary date-range picker deferred.

### 5.5 PWA / offline
- Service worker caches app shell.
- Dataset cached in IndexedDB after first load (hybrid: bundled subset + chunked backend).
- Installable via Web App Manifest + icons.
- No push notifications.
- `start_url` and `scope` = `/nutrition-tracker/`.
- Android (Capacitor): assets bundled in the app package; service worker web-only; dataset chunks fetched from nginx on demand and cached in IndexedDB (ADR-0019).

### 5.6 Attribution
- Persistent attribution footer on Recipes, Log, Reports views: "Data: [OpenNutrition](https://www.opennutrition.app)" + "(c) Open Food Facts contributors" link.
- About view with full ODbL + DbCL license text.
- Attribution cannot be dismissed.

---

## 6. Architecture

### 6.1 Stack
| Layer        | Choice                                              | ADR      |
|--------------|-----------------------------------------------------|----------|
| Frontend     | Vue 3 (Composition API) + Vite + TypeScript         | ADR-0002 |
| UI framework | Naive UI (npm)                                      | ADR-0018 |
| State        | Pinia                                               | ADR-0002 |
| Routing      | Vue Router (`/recipes`, `/log`, `/reports`, `/about`) | ADR-0002 |
| Charts       | Chart.js + vue-chartjs                              | ADR-0007 |
| Persistence  | IndexedDB via Dexie.js                              | ADR-0003 |
| Dataset      | OpenNutrition v2025.1                               | ADR-0004 |
| Deploy       | Static `dist/` on personal nginx, subpath `/nutrition-tracker/` | ADR-0013 |
| Mobile packaging | Capacitor (Android APK, sideloaded)             | ADR-0019 |
| Tests        | Vitest                                              | —        |
| Lint         | ESLint + Prettier                                   | —        |

### 6.2 Dataset delivery (hybrid)
- **Build-time subset**: all `everyday` type foods (5,299 rows, ~4MB JSONL projected) bundled at `dist/data/subset.jsonl`. Loads into IndexedDB on first run before any chunk fetch. (ADR-0012, ADR-0015)
- **Chunked backend**: full parsed dataset split into JSONL chunks by first letter of food name (`a.jsonl`, `b.jsonl`, …, `0-9.jsonl`, `_other.jsonl`). Chunks ~5k rows max, split by second letter if a letter overflows. `manifest.json` lists `{ chunkFile, firstChars, foodCount, sizeBytes }`. Hosted at `/nutrition-tracker/data/chunks/`. Lazy-fetched on demand by query prefix, cached in IndexedDB. (ADR-0011)
- **Subset generator tool**: `scripts/build-subset.mjs` — dev-time script that reads source TSV, projects columns, emits `subset.jsonl` + chunk files + `manifest.json`. Not shipped to users.

### 6.3 Project structure (proposed)
```
nutrition-tracker/
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── sw.js                      # service worker
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   │   └── index.ts
│   ├── stores/                    # Pinia stores
│   │   ├── foods.ts
│   │   ├── recipes.ts
│   │   ├── log.ts
│   │   └── dataset.ts             # chunk fetch + IndexedDB sync
│   ├── db/
│   │   └── dexie.ts               # Dexie schema + liveQuery wrappers
│   ├── views/
│   │   ├── RecipesView.vue
│   │   ├── LogView.vue
│   │   ├── ReportsView.vue
│   │   └── AboutView.vue
│   ├── components/
│   │   ├── FoodSearch.vue
│   │   ├── RecipeEditor.vue
│   │   ├── LogEntry.vue
│   │   ├── MacroTable.vue
│   │   ├── MacroChart.vue
│   │   └── AttributionFooter.vue
│   ├── types/
│   │   └── domain.ts              # Food, Recipe, LogEntry, Macros
│   └── utils/
│       └── macros.ts              # compute per-portion, sum, etc.
├── scripts/
│   └── build-subset.mjs           # dev-time dataset processor
├── docs/
│   ├── PRD.md                     # this file
│   ├── glossary.md
│   └── adr/
│       └── 0001–0017
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .eslintrc / .prettierrc
```

---

## 7. Data model

### 7.1 IndexedDB tables (Dexie)

**`foods`** — projected dataset rows (ADR-0015)
| Field          | Type     | Indexed | Notes                                  |
|----------------|----------|---------|----------------------------------------|
| `id`           | string   | PK      | `fd_...` from dataset                  |
| `name`         | string   | yes     | Search + display                       |
| `altNames`     | string[] | no      | Search match                           |
| `type`         | string   | yes     | `everyday\|grocery\|prepared\|restaurant` |
| `servingMetric`| `{ unit, quantity }` | no | Default log quantity        |
| `nutrition100g`| object   | no      | Full blob; MVP reads 4 fields          |
| `ean13`        | string?  | no      | Future barcode input                   |
| `labels`       | string[] | no      | Secondary filter (deferred)            |

**`recipes`**
| Field              | Type     | Notes                                          |
|--------------------|----------|------------------------------------------------|
| `id`               | string   | PK (uuid)                                      |
| `name`             | string   |                                                |
| `ingredients`      | `{ foodId, quantity, unit }[]` |                                    |
| `portions`         | number   | User-defined                                   |
| `perPortionMacros` | `{ calories, protein, carbs, fat }` | Computed on save             |
| `createdAt`        | ISOString |                                               |
| `updatedAt`        | ISOString |                                               |

**`logEntries`**
| Field           | Type     | Notes                                              |
|-----------------|----------|----------------------------------------------------|
| `id`            | string   | PK (uuid)                                          |
| `timestamp`     | ISOString | Hour precision (date + hour 0–23)                 |
| `kind`          | `'food'\|'recipe'` |                                          |
| `foodRef`       | `{ foodId, foodName, quantity, unit }` | Present if kind=food            |
| `recipeRef`     | `{ recipeId, recipeName, portions }` | Present if kind=recipe           |
| `snapshotMacros`| `{ calories, protein, carbs, fat }` | Per-unit (food) or per-portion (recipe), frozen at log time |
| `createdAt`     | ISOString |                                                   |

**`favorites`**
| Field    | Type     | Notes        |
|----------|----------|--------------|
| `foodId` | string   | PK           |
| `addedAt`| ISOString |              |

**`recents`**
| Field       | Type     | Notes                          |
|-------------|----------|--------------------------------|
| `foodId`    | string   | PK                             |
| `lastUsedAt`| ISOString | Evict oldest beyond 50 entries |

### 7.2 Macro computation
- **Food entry macros** = `nutrition100g.{calories,protein,total_fat,carbohydrates} × (quantity / 100)`.
- **Recipe per-portion macros** = `Σ(food macros per ingredient) ÷ portions`.
- **Recipe entry macros** = `perPortionMacros × portionsLogged`.
- **Day totals** = `Σ(entry macros)` for all entries with `timestamp` date = target day (local).

### 7.3 Frozen snapshot rule (ADR-0005)
At log time, copy the computed macros into `snapshotMacros`. Editing or deleting the source food/recipe never mutates existing log entries. Reports read from `snapshotMacros` only.

---

## 8. UI/UX flows

### 8.1 Views
| Route                  | View          | Purpose                                              |
|------------------------|---------------|------------------------------------------------------|
| `/recipes`             | RecipesView   | List, create, edit, delete recipes                   |
| `/log`                 | LogView       | View/add/edit/delete log entries; supports `?date=`  |
| `/reports`             | ReportsView   | Week chart + daily totals table; click → Log drill   |
| `/about`               | AboutView     | Attribution + license text                           |

### 8.2 Key flows

**Log a food:**
1. Log view → "Add entry" on today's date.
2. FoodSearch component → type query → filter by category → select food.
3. Quantity pre-filled from `servingMetric.quantity`; edit if needed.
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
3. Add ingredients via FoodSearch (food + quantity + unit per line).
4. Save → `perPortionMacros` computed and stored.

**View reports:**
1. Reports view → current week (Mon–Sun) loads.
2. Stacked bar chart renders (protein/carbs/fat per day).
3. Daily totals table below.
4. Click a day bar → navigate to `/log?date=YYYY-MM-DD`.

---

## 9. Technical decisions (ADR index)

| ADR    | Title                                            |
|--------|--------------------------------------------------|
| 0001   | Static PWA architecture                           |
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

---

## 10. Dataset facts (OpenNutrition v2025.1)

| Metric            | Value                          |
|-------------------|--------------------------------|
| Total rows        | 326,759                        |
| TSV size          | 282 MB (uncompressed)          |
| Columns           | 13                             |
| `everyday`        | 5,299 rows (13.1 MB TSV)       |
| `grocery`         | 313,442 rows (236.9 MB, all w/ EAN-13) |
| `prepared`        | 3,836 rows (9.3 MB)            |
| `restaurant`      | 4,182 rows (9.7 MB)            |
| MVP subset        | `everyday` → ~4 MB JSONL projected |
| `nutrition_100g`  | ~80 sub-fields per row (full blob stored) |
| License           | ODbL + DbCL                    |

---

## 11. Build & deploy

- **Build**: `npm run build` → Vite emits `dist/`.
- **Subset generation**: `node scripts/build-subset.mjs` (reads source TSV, emits `dist/data/subset.jsonl` + `dist/data/chunks/*.jsonl` + `dist/data/manifest.json`).
- **Deploy**: copy `dist/` to nginx server root; nginx config:
  ```nginx
  location /nutrition-tracker/ {
    root /var/www;  # parent of dist
    try_files $uri /nutrition-tracker/index.html;
  }
  ```
- **Vite base**: `/nutrition-tracker/`.
- **Router base**: `/nutrition-tracker/`.
- **SW registration**: `/nutrition-tracker/sw.js`.
- **Android build**: Vite build with `base: '/'` + hash router → `npx cap sync android` → APK via Android Studio/Gradle. Sideload only (ADR-0019).

---

## 12. Open items (none blocking MVP)

- Frequency list source for Subset B (skipped; Subset A shipped).
- `labels` as secondary filter axis (trivial if needed).
- Legal review of ODbL terms before any public release.
- Future sync architecture (deferred — requires identity migration).
- Desktop packaging: deferred until Android ships; Wails (Go) preferred; would bundle the full dataset chunk set (ADR-0019).
- F-Droid distribution: requires an app-code license decision + reproducible builds.
