# ADR 0015 — Stored food schema (projected columns)

Date: 2026-08-24
Status: Accepted — amended by ADR-0023: all 13 source columns retained (drop-list retired), `servingCommon` added, measured-0 vs unmeasured semantics introduced

## Context
The OpenNutrition TSV has 13 columns; `nutrition_100g` alone contains ~80 sub-fields. Storing every column verbatim wastes space on fields MVP doesn't use (source, package_size, ingredient_analysis). However, micronutrient display is a likely future feature, and re-fetching rows later is costly.

## Decision
Store a **projected row** in IndexedDB per food:

| Field            | Source column        | MVP use                          |
|------------------|----------------------|----------------------------------|
| `id`             | `id`                 | Primary key                      |
| `name`           | `name`               | Search + display                 |
| `altNames`       | `alternate_names`    | Search (improves hit rate)       |
| `type`           | `type`               | Category filter                  |
| `servingMetric`  | `serving.metric`     | Default log quantity             |
| `nutrition100g`  | `nutrition_100g`     | Full blob stored; MVP displays only `calories`, `protein`, `total_fat`, `carbohydrates` |
| `ean13`          | `ean_13`             | Stored for future barcode input (deferred feature, but field is free to keep) |
| `labels`         | `labels`             | Secondary filter / display       |

**Dropped** (not stored in MVP): `description`, `source`, `package_size`, `ingredients`, `ingredient_analysis`.

## Consequences
- Full `nutrition_100g` blob stored (~1KB/row) → ~320MB for full dataset in IndexedDB. Acceptable for personal use; micronutrient features unlock without re-fetch.
- `altNames` stored as JSON array; search matches against `name` OR any `altNames` entry.
- `ean13` kept because the field is already present and barcode input is a plausible future feature — no extra fetch cost.
