# ADR 0027 — Export/import format: JSON with merge-by-id semantics

Date: 2026-09-26

## Context

v1.1 adds export/import of recipes and log entries to text files. Three use cases:

1. App backup/restore.
2. Attaching data to an LLM conversation thread.
3. Dropping exported recipes into a server-side directory for shared access (ADR-0028).

A future v1.x one-shot sync feature (ADR-0029) will reuse the same format as its wire payload, so the format and merge rules must live in `shared/` from day one.

JSON vs TOML was evaluated for human-readability and downstream use. The data is deeply nested: recipes hold `ingredients[]` of objects; log entries hold `foodRef`/`recipeRef` discriminated unions; `Nutrition100g` is an open map. TOML expresses arrays-of-tables verbosely (`[[recipe.ingredients]]` blocks), handles unions poorly, and has no advantage for machine consumers — every downstream target (zod, JS, LLMs) parses JSON natively. Pretty-printed JSON is sufficiently human-readable for data dumps.

## Decision

- **Format: JSON**, pretty-printed. Envelope:

  ```json
  {
    "format": "nutrition-tracker",
    "version": 1,
    "exportedAt": "<ISO>",
    "recipes": [ /* Recipe[] */ ],
    "logEntries": [ /* LogEntry[], optional */ ]
  }
  ```

- **Schema** (zod) lives in `shared/serialization/` with `serialize()` and `merge()`. The `recipes` array is length-agnostic (1..N): a file may hold one recipe or all of them — server-dir ingestion (ADR-0028) and per-recipe export both emit the same shape.
- **Content selection** at export time (checkboxes: recipes / log entries / log date range), but one schema regardless of selection.
- **Merge semantics on import**: recipes merge-by-id with last-write-wins on `updatedAt`; log entries insert-if-absent (same id = skip — they are immutable events); invalid entries are rejected individually with a per-item error report surfaced to the user.
- **Restore**: a "replace all" destructive option exists for backup restore, behind a confirm modal naming destroyed counts. Merge is the default.
- **File names**: `nutrition-tracker-recipes-<date>.json`, `nutrition-tracker-log-<date>.json`, `nutrition-tracker-recipe-<slug>.json` (single recipe).

## Consequences

- One deep module (`shared/serialization/`) serves import, server-recipe ingestion, LLM attach, and future sync. Conflict resolution evolves in exactly one place.
- No zip dependency: bulk export is one file; single recipes are separate files.
- TOML rejected: verbose for nested data, no downstream advantage.
- `merge()` is pure and unit-tested (collision cases: newer/older/equal `updatedAt`, log idempotency, invalid items).
- UI: new "Backup" view owns full export/import; Recipes view has lightweight export actions only (ADR-0028 flow requires per-recipe and all-recipe files).
