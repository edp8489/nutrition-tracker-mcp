# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.2.0] — 2026-10-06

### Added

- Recipe embedding: add a saved recipe to a new recipe from the editor (e.g. "Pea Pesto Sauce" → "Chicken pesto sandwich"), by portion count. Embeds are flattened into food ingredients on save (snapshot, ADR-0031); no schema, export, or server changes.
- UI improvements: Fat and carbohydrate sub-entries in nutrition tables (recipe detail, day report): saturated / trans / polyunsaturated / monounsaturated fat under **Total fat**; total sugars, added sugars, dietary fiber, soluble fiber, insoluble fiber under **Carbohydrates** — shown before the remaining micronutrients (FDA label order).
- Server metrics logging: (optional) enable logging of privacy-respecting server usage metrics. Hourly and daily snapshots of the following counts: requests per endpoint, errors, unique users. Requests payloads are **not** saved. Unique users based on salted hash of request IP address. Salt is saved in-memory only and rotated daily + on server restarts.

## [1.1.0] — 2026-09-29

### Added

- Backup and restore recipes and log entries as JSON files.
- Server recipes: Saved recipe files on server (`data/recipes/`) are available for all users to import into personal collections and edit.

## [1.0.0] — 2026-09-23

### Added

- Initial release: food search (OpenNutrition dataset via MCP server), recipes with per-portion macros, freeform food log with frozen macro snapshots, day/week reports.
