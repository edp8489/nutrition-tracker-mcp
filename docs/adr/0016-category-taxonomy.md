# ADR 0016 — Category taxonomy from `type` field

Date: 2026-08-24
Status: Accepted

## Context
Q3 (B) selected category filters on food search. Need a taxonomy. The dataset's `type` column provides a built-in classification.

## Decision
Use the dataset's `type` field as the primary category axis. Four values:

| Type        | Count    | Description                          |
|-------------|----------|--------------------------------------|
| `everyday`  | 5,299    | Generic/common foods (in build subset) |
| `grocery`   | 313,442  | Branded packaged foods (all have EAN-13) |
| `prepared`  | 3,836    | Prepared dishes                      |
| `restaurant`| 4,182    | Restaurant items                     |

UI exposes a filter control: All / Everyday / Grocery / Prepared / Restaurant (multi-select or single-select toggle).

`labels` (e.g., `["cooked"]`, `["raw"]`) available as a secondary filter axis — deferred beyond MVP unless trivial.

## Consequences
- Category filter is a simple equality on `type`; indexed in Dexie.
- Build-time subset (ADR-0012) = all `everyday` rows (13.1MB TSV → ~4MB JSONL projected).
