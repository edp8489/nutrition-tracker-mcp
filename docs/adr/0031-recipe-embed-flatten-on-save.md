# ADR 0031 — Recipe embedding via flatten-on-save

Date: 2026-10-01

## Context

v1.0 explicitly excluded nested recipes ("no recipe-as-ingredient"): `Ingredient` carries a `foodId` only. Users want to compose recipes from saved recipes — e.g. use a saved "Pea Pesto Sauce" recipe inside a new "Chicken pesto sandwich" recipe instead of re-entering its foods.

Two candidate designs:

1. **Stored reference** — `Ingredient` gains a `kind` discriminator with `recipeId` links; consumers resolve the link at read time.
2. **Flatten-on-save** — the editor accepts recipe rows, but saves (and previews) the recipe's stored food ingredients scaled by the embedded portion ratio.

## Decision

**Flatten-on-save.** The recipe editor (`RecipeEditor.vue`) draft rows are a discriminated union: food rows (ADR-0024 household units) and recipe rows (`recipeId` + how many portions of the sub-recipe, fractional allowed). `toStorageIngredients()` expands each recipe row into the sub-recipe's stored metric ingredients × `portions / subRecipe.portions` — the same expansion feeds the live per-portion preview (`computeRecipeMacros`) and the save path.

The saved `Recipe` therefore remains a flat list of food `Ingredient`s. No change to:

- `Ingredient` domain type, Dexie schema, or `computeRecipeMacros` (ADR-0020: summation stays server-side; the MCP server cannot see client recipes anyway).
- Export/import envelope or merge logic (ADR-0027 — the schema stays food-only).
- Log rollups and day reports (recipes keep frozen `perPortionMacros`/`perPortionNutrition`, ADR-0005/0026).

Embedding a recipe is thus a **snapshot**: later edits to the sub-recipe do not propagate to recipes that embedded it, and re-opening the parent shows the flattened food rows, not the recipe link. This is consistent with the app's existing snapshot philosophy (ADR-0005/0026).

Because saved recipes are always flat, embedding cannot create cycles; the only guard needed is excluding the currently-edited recipe from the picker (self-embed). A sub-recipe deleted mid-draft has its rows skipped.

## Consequences

- Zero server contract, storage, or export changes; the feature is entirely editor-side.
- Sub-recipe edits don't propagate — re-embed to pick up changes (delete + re-add the recipe row).
- Embedded foods surface individually in the parent's editor and exports, which also keeps full-nutrition computation exact (per-100 g blobs summed, not approximated from the sub-recipe's frozen per-portion snapshot).
- If propagation is ever required, migrating means introducing a `kind: 'recipe'` ingredient across the stack — deliberately deferred.
