# ADR 0023 — Stored schema: full-column retention + measured-value semantics

Date: 2026-09-13
Status: Accepted — amends ADR-0015

## Context
Two problems with the projected schema (ADR-0015). First, MCP tools need fields the projection drops: `ingredient_analysis` (gluten/allergen tags for best-effort gluten-free answers), `ingredients`, `description`; the source `serving` blob also carries a `common` household serving that unit conversion needs (ADR-0024). Second, the source dataset stores **unmeasured nutrients as explicit `0`** — e.g. chicken breast reports `biotin: 0`, `iodine: 0`, `caffeine: 0`. Key-absence cannot signal "unmeasured" (sampled rows carry all ~90 nutrition keys), so an LLM or user could assert "contains no X" from an unmeasured zero. The build tool additionally fabricates `{calories: 0, protein: 0, total_fat: 0, carbohydrates: 0}` defaults when a row lacks the nutrition blob.

## Decision
- **Keep all 13 source TSV columns** in the projected rows (subset, chunks, SQLite). The ADR-0015 drop-list (`description`, `source`, `package_size`, `ingredients`, `ingredient_analysis`) is retired.
- **Add `servingCommon`** — `{ unit, quantity }` from `serving.common` (e.g. `{ unit: "cup", quantity: 1 }` for cooked rice; `{ unit: "large egg", quantity: 1 }`), stored alongside `servingMetric`.
- **Measured-value semantics**:
  - Absent nutrition key → `null` (unmeasured), never fabricated.
  - A curated per-field **tier map** defines which fields are "reliably measured" (core macros, energy, fat/carbohydrate breakdown, sodium, fiber, sugars).
  - Out-of-tier explicit zeros (biotin, iodine, caffeine, …) are served with `measured: false`; tool results carry phrasing guidance so the model says "not reported" rather than "contains none".
  - In-tier values are served with `measured: true`; caveats still present where a zero could be ambient (e.g. caffeine).
- **Fix `build-subset.mjs`**: a missing nutrition blob yields `null` nutrition, not zero-filled defaults.

## Consequences
- `getIngredientMacros` can never yield a false "contains no X" assertion (ADR-0020 principle 2).
- Stored row size grows (ingredients/analysis text, notably for `grocery` rows); acceptable for personal use — the full SQLite DB lives on desktop disk, Android seeds from the small `everyday` subset, and the external variant is deferred.
- The tier map is server-side configuration, versioned with the schema; changing it does not require a dataset rebuild.
- Gluten-free answers remain best-effort: only rows with `ingredient_analysis` tags can be answered, phrased as "no gluten-tagged ingredients in data", never as certified.