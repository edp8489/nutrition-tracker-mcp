# ADR 0031 — Usage metrics: opt-in, privacy-preserving aggregates in a separate SQLite store

Date: 2026-10-03

## Context

The server is stateless and anonymous by design (ADR-0009, ADR-0020): no users, no auth, no sessions, and a stated invariant that user data never reaches the server. Operators still need basic insight — which endpoints/tools get used, request counts, latency, roughly how many clients connect — without violating that invariant. Docker deployments only reliably expose stdout as an observability channel, and restarts must not lose data.

## Decision

- **Opt-in via `NUTRITION_ENABLE_LOGGING` (default 0).** When unset or 0, no code path touches request data. Invalid logging config is fatal at startup; environment failures (disk, permissions) disable metrics softly and never take down serving.
- **Separate writable store `metrics.sqlite`** (default `server/data/metrics/`, `NUTRITION_METRICS_DIR`), one row per request: UTC ts, endpoint key, duration, error flag, client-day hash, UA bucket. Snapshots are `GROUP BY` queries over the rows — no derived state, restart-safe, history always re-queryable. Retention: `NUTRITION_METRICS_RETENTION_DAYS` — `-1`/unset = keep forever (default), `>= 1` = prune after N days (0 is rejected: "logging enabled but zero retention" is a contradiction; disable logging instead).
- **Endpoint keys**: `http:/mcp`, `http:static`, `http:static:404`, `mcp:tool:<name>`. Tool names only — arguments, payloads, query strings, and raw headers are never recorded.
- **Client identity = client-day hash**: HMAC-SHA256 of the client IP with an ephemeral 32-byte salt that lives only in memory and rotates at local midnight (discarded on rotation and restart). Stored hashes cannot be linked across days (salt rotates) nor recomputed against candidate IPs (salt is gone). A mid-day restart re-salts and may double-count an active client — accepted: privacy over exact uniques. `uniqueClients` is a `COUNT(DISTINCT client_day_hash)`, never a stored identity. The honest fallback for "no IP handling at all" (report `not tracked`) was rejected in favor of the rotating-salt count; if even transient IP reads become unacceptable, remove hashing — the store schema tolerates null hashes.
- **IP source**: direct socket address (`server.requestIP`); `X-Forwarded-For` (first hop) only when `NUTRITION_TRUST_PROXY=1` — never both a proxy-trust flag and blind XFF trust.
- **UA buckets**: coarse classification only (default rules: `browser`/`claude-code`/`codex`/`opencode`; fallbacks `other` = unmatched, `unknown` = missing). Rules file-configurable (`NUTRITION_UA_BUCKETS_FILE`, JSON array of `{match, bucket}`, first substring match wins, replaces defaults). UAs are client-controlled; buckets are advisory statistics, not identity.
- **Snapshots from the store, emitted at H:59:30 local**:
  - Hourly window `[H:00, H:59:30)`: per-endpoint request counts, single-line JSON to stdout.
  - Daily window `[00:00, 23:59:30)`: per-endpoint requests/avgMs/errors + unique clients + UA buckets.
  - Emitting 30 s before each boundary means every line lands in the log file of the local day it describes. The final 30 s of each window is stored but never snapshot-reported (~0.17% of data) — accepted for correct file placement.
  - All windows align to the container's local clock (`TZ`); storage stays UTC; labels and `window` fields are local with offset. Idle hours are marked processed but print nothing. Completed-but-unreported windows are backfilled on startup from the store (bounded by first request ts / last marker), so restarts never lose a snapshot.
- **Optional plaintext log**: when `NUTRITION_METRICS_LOG_DIR` is set, each snapshot line is also appended to `stdout-YYYY-MM-DD.log` (local date of the window) as it is emitted — a copy of the metrics stdout stream, without intercepting global `console`.

## Consequences

- Privacy invariant preserved: no IPs, no payload content, no tool arguments, no versioned UAs, no linkable client identifiers are ever persisted. ADR-0020's "no user data on the server" holds — the store describes server load, not users.
- `uniqueClients` is approximate: restarts may over-count within a day, and behind an untrusted proxy without `NUTRITION_TRUST_PROXY` all clients collapse to one (the proxy's address).
- Metrics cost one prepared INSERT per request in a WAL-backed SQLite file; snapshots are a handful of aggregate queries per hour — negligible at self-hosted scale, and the store grows ~1 KB per 1k requests (prunable via retention).
- DST transitions make emission instants shift ±1 h and the repeated fall-back hour merges into one window; data is never lost, window labels stay honest.
- `node:sqlite` (not `bun:sqlite`) is the store driver so the module is testable under Node-run vitest as well as the Bun server (both implement it); the vitest `node:sqlite` alias shim lives in `server/metrics/node-sqlite.cjs`.
