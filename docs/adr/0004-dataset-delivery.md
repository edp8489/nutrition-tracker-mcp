# ADR 0004 — OpenNutrition dataset delivery: hybrid (build subset + chunked backend fetch)

Date: 2026-08-24
Status: Accepted — platform note via ADR-0019 superseded; amended by ADR-0021/0022: subset + chunk delivery now serves the external web variant (deferred) and Android's optional full-dataset download (imported into on-device SQLite); the MCP server reads the full dataset from SQLite (ADR-0020)

## Context
OpenNutrition dataset is a ~111MB zip containing a single `opennutrition_foods.tsv`. Shipping the full dataset in the app bundle is impractical. User needs full offline access after first load, and a usable core set immediately on first paint.

## Decision
Hybrid delivery:
1. **Build-time subset** — a slimmed set of generic/common foods (~few MB) bundled in `dist/` so the app is functional before any backend fetch.
2. **Chunked backend** — the full parsed dataset split into chunks (see Round 2 for format/size), hosted as static files on the personal nginx server alongside the app. Client lazy-fetches chunks on demand or via a "download full dataset" action, then caches each chunk in IndexedDB.

## Consequences
- App shell + subset is usable immediately; full dataset loads progressively.
- nginx serves both app and dataset chunks from the same static root (no separate CDN needed for MVP).
- Chunk format, size, and subset selection criteria — TBD in Round 2.
- Dataset is treated as a derivative DB under ODbL (see ADR-0008).
