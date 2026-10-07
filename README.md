# Nutrition MCP

## Introduction

A calorie and macronutrient tracker built around an [MCP](https://modelcontextprotocol.io) server. A single Bun process exposes a streamable-HTTP MCP API backed by the OpenNutrition dataset (SQLite + FTS search) and serves a Vue 3 web app — search foods, build recipes, compute macros, and log what you eat.

Tools exposed to your LLM client:

- `searchIngredient` — FTS-backed food search with category/tag filters
- `getIngredientMacros` — per-100g and per-serving nutrition with measured/unmeasured flags
- `computeRecipeMacros` — deterministic macro summation for a recipe
- `filterFoods` — nutrient ranges and dietary presets (keto, high-protein, …)
- `convertUnits` — unit conversion, food-aware where possible
- `getServerRecipes` — returns every recipe from the server's `recipes/` directory (one JSON file per recipe), validated against the export envelope; invalid files are skipped and reported. Directory is read fresh on each call, so newly added files appear without a restart.

All arithmetic happens server-side, so the model never does math or invents nutrition data. Single-user by design: logs, recipes, and favorites live in your browser's IndexedDB and never leave your machine.

## Usage

Requirements: [Bun](https://bun.sh) and Docker (for server deployment only).

1. Clone repository

2. Download latest OpenNutrition dataset from https://www.opennutrition.app/download and extract to local directory (e.g. `external/opennutrition-dataset-YYYY/`)

3. (First run only) Install dependencies and create OpenNutrition.sqlite database

    `bun install && bun run build:sqlite external/opennutrition-dataset-2025.1/opennutrition_foods.tsv`

    The TSV is gitignored — obtain the OpenNutrition dataset release first and place it at that path. The build writes `opennutrition.sqlite` next to the TSV.

    Recommended organization:

    ```
    mkdir -p data/recipes

    mv external/opennutrition-dataset-YYYY.MM/opennutrition.sqlite data/
    ```

4. **Dev Server (Vite)** Copy or symlink database to `server/data/` and recipes folder to `server/data/recipes/`

5. **Docker Deploy** Adjust the bind mount paths in `docker-compose.yml`:

    ```
    ...
    volumes:
    - "./data/opennutrition.sqlite:app/server/data/opennutrition.sqlite:ro"
    - "./data/recipes:/app/server/data/recipes:ro"
    ...
    ```


6. **Docker** Start the container: `docker compose up -d --build`

Web app: `http://<host>:3000/nutrition-tracker/`

MCP endpoint: `http://<host>:3000/mcp` — point your chat client (Claude Desktop, OpenWebUI, etc.) at this URL

## Metrics & logging

Opt-in server usage/performance metrics (ADR-0031), **off by default**. Enable with `NUTRITION_ENABLE_LOGGING=1` (all variables are documented, commented, in `examples/example.env`):

| Variable | Default | Meaning |
|---|---|---|
| `NUTRITION_ENABLE_LOGGING` | `0` | `1` enables metrics; unset/`0` disables (no request data is touched) |
| `NUTRITION_METRICS_DIR` | `server/data/metrics` | Directory for the writable `metrics.sqlite` store (volume-mount it) |
| `NUTRITION_METRICS_LOG_DIR` | unset | When set, also append snapshot lines to `stdout-YYYY-MM-DD.log` (one file per local day) |
| `NUTRITION_TRUST_PROXY` | `0` | `1` reads the first `X-Forwarded-For` hop (only behind a proxy you control) |
| `NUTRITION_METRICS_RETENTION_DAYS` | `-1` | `-1`/unset = keep forever; `>= 1` = prune raw rows after N days; `0` is a startup error |
| `NUTRITION_UA_BUCKETS_FILE` | unset | JSON `[{match, bucket}]` rules replacing the built-in UA buckets |
| `TZ` | `UTC` | Snapshot windows and log-file rollover follow the container's local clock |

What gets recorded — per request, in a separate SQLite store: UTC timestamp, endpoint (`http:/mcp`, `http:static`, `http:static:404`, `mcp:tool:<name>`), duration, error flag, a per-day anonymous client hash, and a coarse client bucket (`browser`, `claude-code`, `codex`, `opencode`, `other`, `unknown`). **Never recorded**: IPs, request payloads, tool arguments, full User-Agents, or anything linkable to a person. Unique clients are counted via a salted hash whose salt is discarded daily — it cannot be reversed, linked across days, or recomputed later.

Output, single-line JSON on stdout:

```json
{"type":"usage-hourly","window":"2026-10-03T12:00:00–12:59:30-04:00","timezone":"America/New_York","requests":{"http:/mcp":37,"mcp:tool:searchIngredient":25},"total":159}
{"type":"usage-daily","window":"2026-10-02T00:00:00–23:59:30-04:00","timezone":"America/New_York","endpoints":{"http:/mcp":{"requests":812,"avgMs":23.4,"errors":3},"mcp:tool:searchIngredient":{"requests":700,"avgMs":41.2,"errors":1}},"uniqueClients":4,"uaBuckets":{"browser":132,"claude-code":668},"total":812}
```

Hourly snapshots emit at H:59:30 local, the daily snapshot at 23:59:30 — so every line belongs to the local day it describes. Idle hours print nothing; snapshots missed by a restart are backfilled from the store on startup.

## License
See LICENSE.md

## Contributing
See CONTRIBUTING.md