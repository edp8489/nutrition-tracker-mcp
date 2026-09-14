# ADR 0011 — Dataset chunks: JSON Lines by first letter

Date: 2026-08-24
Status: Accepted — amended by ADR-0021/0022: chunks serve the external web variant and Android's optional full-dataset download (imported into on-device SQLite); the MCP server reads SQLite (ADR-0020)

## Context
Full parsed dataset (~111MB) is split into chunks for lazy fetch + IndexedDB caching (see ADR-0004). Need a format and partitioning scheme that supports targeted fetch by query prefix and is cheap to parse in-browser.

## Decision
- Format: **JSON Lines** (one JSON object per line).
- Partition: **by first character of food name** → `a.jsonl`, `b.jsonl`, …, `z.jsonl`, `0-9.jsonl`, `_other.jsonl`.
- Each chunk ~5k rows max (split further by second character if a letter overflows).
- A `manifest.json` lists `{ chunkFile, firstChars, foodCount, sizeBytes }` for all chunks.

## Consequences
- Targeted fetch: user types "banana" → fetch `b.jsonl` only.
- JSONL streams via `fetch().body.getReader()` + `JSON.parse` per line; no full-buffer parse.
- Build tool (see ADR-0014) generates chunks + manifest from the source TSV.
