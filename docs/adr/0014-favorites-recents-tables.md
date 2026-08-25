# ADR 0014 — Favorites and Recents as separate tables

Date: 2026-08-24
Status: Accepted

## Context
Need quick-access shortcuts in food search. Favorites are user-flagged foods; recents are foods recently logged or searched. Mutating dataset rows to add a `favorite` flag couples user state with cached dataset data.

## Decision
Two separate Dexie tables, neither touching the dataset table:
- `favorites`: `{ foodId, addedAt }` — primary key `foodId`.
- `recents`: `{ foodId, lastUsedAt }` — primary key `foodId`, capped at 50 entries. On insert beyond 50, evict oldest by `lastUsedAt`.

## Consequences
- Dataset table stays immutable; favorites/recents survive dataset re-fetches.
- Search UI joins dataset rows with favorites/recents in-memory.
- Cap of 50 recents is a runtime eviction, not a schema constraint.
