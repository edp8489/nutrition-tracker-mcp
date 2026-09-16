# ADR 0026 — Full-nutrition snapshots, recipe breakdowns, and log notes

Date: 2026-09-16

## Context

Three features:

1. Freeform notes on food-log entries (e.g. "stomach felt upset an hour later"), editable after logging.
2. A Recipe "detailed view" reporting the full nutrient breakdown (sodium, fiber, sugars, vitamins, …) summed across all ingredients.
3. A "Day" report showing the same full breakdown summed over the day's log entries.

`computeRecipeMacros` returned the four MVP macros only, and log entries froze only those macros at log time (ADR-0005). The dataset's `nutrition100g` blob carries ~90 nutrient sub-fields per 100 g with measured-value semantics (ADR-0023).

## Decision

- **Extended frozen snapshots (ADR-0005):** `LogEntry.snapshotNutrition` and `Recipe.perPortionNutrition` freeze the full measured blob at log/save time. Legacy entries lack them; reports never re-resolve foods to backfill — entries stay self-contained.
- **Partial coverage with a caveat:** the Day report always computes the core four macros from every entry, and the extended fields from the entries that carry `snapshotNutrition`, with a visible "covers N of M entries" note.
- **Additive tool contract (ADR-0025):** `computeRecipeMacros` gains `totalNutrition`/`perServingNutrition` (`ServedNutrient[]`, measured fields only, out-of-tier zeros excluded per ADR-0023; a caveat fires when a field is not reported by every ingredient). Existing chat clients change nothing.
- **Recipe detailed view computes on demand** through the MCP tool from the stored ingredients (ADR-0020: summation never happens in the app).
- **Notes** are a plain non-indexed `LogEntry.note` string — no Dexie schema version bump is required for any of the new fields (all non-indexed).

## Consequences

- Full-nutrition detail accrues only for entries logged after this change; old history shows macros plus a coverage note.
- Recipes saved before this change lack `perPortionNutrition` until re-saved, but their detailed view works regardless (on-demand recompute).
- Storage cost: small per-entry duplication (≤ ~90 numeric fields), consistent with ADR-0005's accepted cost.
- The web UI gains its first "not reported" affordance (`—` rows in `NutritionTable`), honoring ADR-0023's rule against fabricated zeros.
