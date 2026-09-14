# ADR 0025 — Hybrid search: FTS5 BM25 first, local embeddings later

Date: 2026-09-13
Status: Accepted

## Context
`searchIngredient` must hit exact names and aliases ("grilled chicken breast" must match the cooked entry) and survive fuzzy phrasing ("lean poultry"). Keyword-only search misses fuzzy queries; vector-only search misses exact names; both are needed eventually. OpenAI embeddings are rejected — local, open-weights inference is preferred (owner's stack is a local LLM setup: OpenWebUI et al.).

## Decision
- **v1: BM25 keyword search** via SQLite **FTS5** over weighted columns: `name`, `altNames`, `labels`, plus `description` and `ingredients` at lower weight. Alias-aware indexing; category (`type`) filtering via the base table.
- **Phase 2: hybrid recall** with local open-weights embeddings — **nomic-embed-text-v1.5** or **Snowflake arctic-embed**, run locally (transformers.js/ONNX or the Ollama embedding API), stored in **sqlite-vec**. BM25 and vector results are merged (reciprocal rank fusion or score normalization, decided at implementation).
- The `searchIngredient` contract (parameters, filters, result shape) is fixed in v1 so the phase-2 addition requires no client changes.

## Consequences
- v1 ships with zero model dependencies; embeddings are a pure backend addition.
- Embedding the ~326k-row corpus is a one-time local batch job; index size ~50–100 MB at 384–768 dims.
- Fuzzy-query recall improves only in phase 2; exact-name and alias queries are fully served in v1.
- `bun:sqlite` FTS5 availability is covered by the Phase-0 spike (ADR-0020); the Android storage-adapter spike (ADR-0022) covers the same index on-device.