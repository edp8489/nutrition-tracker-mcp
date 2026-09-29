# ADR 0028 — Server recipes: read-only bind mount + MCP tool

Date: 2026-09-26

## Context

Use case 3 of v1.1: recipes saved at the server level should propagate to every instance of the personal web app. The deployment is a single Bun MCP-server process serving both `/mcp` and the built SPA (ADR-0020). User data lives per-install in IndexedDB (ADR-0009); there is no server-side user store.

## Decision

- **Docker bind mount**: `docker-compose.yml` gains `./recipes:/app/server/recipes:ro`. Users drop exported recipe files into this directory on the host.
- **One file per recipe** (e.g. `breakfast-smoothie.json`, `lunch-sandwich.json`) for easy maintenance; files use the ADR-0027 export envelope (`recipes` array length 1..N, so multi-recipe files also work).
- **New MCP tool `getServerRecipes`** (impl in `shared/tools/`, schema in `shared/schemas.ts`, registered in `buildServer()`): reads the directory fresh on every call — no cache, no watcher. Small recipe counts make per-call reads cheap, and fresh reads reflect newly dropped files without restart.
- Validation: glob `*.json`, validate each file against the recipe schema, merge all valid recipes into one array. Invalid files are skipped and logged — one bad file never fails the whole directory.
- **Read-only semantics**: users cannot edit or delete server recipes in place. Each card offers "Import to my recipes", which copies the recipe into local IndexedDB with a new uuid; the copy is fully editable.
- **UI (Recipes view)**: a separate "Server recipes" section below personal recipes, shown/hidden via a naive-ui `n-collapse` (default expanded), with a "Display server recipes" toggle and a manual refresh icon. Frontend fetches via `getServerRecipes` on view mount when enabled. Server recipes are visually distinguished (badge/secondary card style).

## Consequences

- Server stays stateless with respect to user data; the mount is read-only, so no write-permission or sync-back complexity.
- Propagation requires only a page refresh — no server restart.
- The reuse of the ADR-0027 envelope means a user's export file drops straight into the directory unmodified.
- Naming convention is convention, not enforcement: any valid `*.json` recipe file is accepted.
