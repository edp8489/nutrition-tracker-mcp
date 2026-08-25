# ADR 0005 — Frozen nutrition snapshot at log time

Date: 2026-08-24
Status: Accepted

## Context
Log entries reference foods (dataset rows) and recipes. Recipes and the dataset can change or be deleted. Past logs must remain stable and accurate regardless of later edits.

## Decision
Each log entry stores a **frozen snapshot** of the per-portion nutrition values at the moment the entry is created:
- For a food entry: copy the food's macro values (per reference unit) into the entry.
- For a recipe entry: copy the recipe's computed per-portion macros into the entry.
- Editing or deleting a recipe/food never mutates existing log entries.

## Consequences
- Log entries are self-contained; reports can be computed from entries alone without re-resolving references.
- Recipe deletion = hard delete from the recipe list; past logs unaffected.
- Storage cost: small per-entry duplication. Acceptable for personal use.
- Dataset updates (deferred) do not retroactively alter history.
