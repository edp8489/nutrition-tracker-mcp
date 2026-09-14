# ADR 0022 — Android: embedded MCP tool library + on-device SQLite

Date: 2026-09-13
Status: Accepted — amends ADR-0019

## Context
Directive: the Android app uses the MCP tool surface. A WebView cannot listen on ports, so a localhost HTTP server inside the app is not viable. With the tool implementations in TypeScript (ADR-0020), no separate runtime is needed — the Capacitor bundle already runs JavaScript. The app must remain offline-first, as today.

## Decision
- **Embedded tool library**: the shared TypeScript tool library (`shared/` — the same contracts and implementations as the MCP server's tools) is compiled into the Capacitor bundle and called **in-process** by the app UI. Android consumes the MCP *contract* directly; HTTP endpoints remain a desktop concern. A future on-device LLM chat layers a transport over the same library.
- **On-device SQLite**: food data lives in SQLite, seeded on first launch from the bundled `everyday` subset (5,299 rows). The user may optionally download the remaining dataset chunks (nginx-hosted JSONL per ADR-0011) and import them into the SQLite database. No remote server is required for app functionality.
- **Storage adapter**: the tool library consumes SQLite through a thin adapter — `bun:sqlite` on the server, the spike-chosen mechanism on Android.
- **User data** (logs, recipes, favorites, recents) stays in IndexedDB via Dexie, unchanged.
- **Phase-0 spike** (before implementation): choose the SQLite access mechanism in the WebView — `@capacitor-community/sqlite` (native) vs SQLite compiled to WASM with OPFS persistence — and verify FTS5 availability. Fallbacks, in order: prebuilt FTS index shipped as an asset; Android platform SQLite (FTS3/4) via a thin native wrapper; last resort — keep the current chunk-to-Dexie data path on Android.

## Consequences
- Android is fully self-contained; nginx reachability is needed only for the optional full-dataset download.
- The MCP tool contract has three consumers: chat clients (streamable HTTP), personal web app (streamable HTTP), Android (in-process library).
- The Python-on-Android path (Chaquopy) is dropped along with the Python runtime assumption (ADR-0020).
- ADR-0019's chunk-fetch-into-IndexedDB data path is replaced by chunk-import-into-SQLite; per-device data islands remain by design (ADR-0009, ADR-0021).