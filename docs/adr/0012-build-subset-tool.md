# ADR 0012 — Build-time subset: generic foods + frequency list

Date: 2026-08-24
Status: Accepted

## Context
App must be usable on first paint before any backend chunk fetch. Need a slimmed set bundled in `dist/`. Two candidate selection methods (generic foods filter, frequency list) — owner will evaluate both via a dev tool and decide.

## Decision
- Build a **subset generator tool** (`scripts/build-subset.mjs`) that emits two candidate subsets from the source TSV:
  - **Subset A**: all generic foods (exclude branded/restaurant) — selection criteria based on a dataset field (to be confirmed via TSV header inspection).
  - **Subset B**: top-N foods by a frequency list (N configurable, default 1000).
- The owner evaluates both (size, coverage) during development and locks one as the bundled subset.
- Whichever is chosen, the subset ships at `dist/data/subset.jsonl` and loads into IndexedDB on first run before any chunk fetch.

## Consequences
- Decision on A vs B deferred until the tool runs and both are inspected.
- Tool is a dev-time dependency, not shipped to users.
