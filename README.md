# Nutrition MCP

## Introduction

A calorie and macronutrient tracker built around an [MCP](https://modelcontextprotocol.io) server. A single Bun process exposes a streamable-HTTP MCP API backed by the OpenNutrition dataset (SQLite + FTS search) and serves a Vue 3 web app — search foods, build recipes, compute macros, and log what you eat.

Tools exposed to your LLM client:

- `searchIngredient` — FTS-backed food search with category/tag filters
- `getIngredientMacros` — per-100g and per-serving nutrition with measured/unmeasured flags
- `computeRecipeMacros` — deterministic macro summation for a recipe
- `filterFoods` — nutrient ranges and dietary presets (keto, high-protein, …)
- `convertUnits` — unit conversion, food-aware where possible

All arithmetic happens server-side, so the model never does math or invents nutrition data. Single-user by design: logs, recipes, and favorites live in your browser's IndexedDB and never leave your machine.

## Usage

Requirements: [Bun](https://bun.sh) and Docker (for server deployment only).

1. Clone repository

2. Download latest OpenNutrition dataset from https://www.opennutrition.app/download and extract to local directory (e.g. `external/opennutrition-dataset-YYYY/`)

3. (First run only) Install dependencies and create OpenNutrition.sqlite database

`bun install && bun run build:sqlite external/opennutrition-dataset-2025.1/opennutrition_foods.tsv`

The TSV is gitignored — obtain the OpenNutrition dataset release first and place it at that path. The build writes `opennutrition.sqlite` next to the TSV.

4. Copy the database next to `docker-compose.yml` or adjust the bind mount path if you keep it elsewhere:

```
mkdir -p data && cp external/opennutrition-dataset-2025.1/opennutrition.sqlite data/
```

5. Start the container:

`docker compose up -d --build`

- Web app: `http://<host>:3000/nutrition-tracker/`
- MCP endpoint: `http://<host>:3000/mcp` — point your chat client (Claude Desktop, OpenWebUI, etc.) at this URL

## License
See LICENSE.md

## Contributing
See CONTRIBUTING.md