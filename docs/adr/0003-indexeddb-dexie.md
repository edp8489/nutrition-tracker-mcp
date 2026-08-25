# ADR 0003 — IndexedDB via Dexie.js for local persistence

Date: 2026-08-24
Status: Accepted

## Context
Need persistent client-side storage for the OpenNutrition dataset (~111MB parsed), user recipes, and log entries. Considered Dexie.js, idb, and RxDB.

| Option   | Pros                                          | Cons                                    |
|----------|-----------------------------------------------|------------------------------------------|
| Dexie   | Mature, typed queries, reactive hooks, ~20KB | Manual sync layer when sync arrives      |
| idb      | Thin, promise wrapper, smallest               | Less ergonomic; no query builder        |
| RxDB     | Built-in sync, reactive queries               | Overkill for MVP; larger bundle; complex |

## Decision
Use **Dexie.js**. MVP is single-user, single-device; no sync needed. Dexie gives a clean typed query API and `liveQuery` reactivity that pairs well with Pinia.

## Consequences
- Future sync (deferred) will require a custom sync layer on top of Dexie, or migration to RxDB. Acceptable — sync is explicitly post-MVP.
- Reactive Dexie `liveQuery` results feed Pinia stores; components subscribe via store getters.
