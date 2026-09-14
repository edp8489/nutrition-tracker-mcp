# ADR 0001 — Static PWA architecture

Date: 2026-08-24
Status: Accepted — amended by ADR-0019: Capacitor adds an Android distribution channel; amended by ADR-0021: static-PWA architecture now describes the external web variant only — the personal web app and Android consume the MCP tool library

## Context
Calorie/macro tracker for personal use. Must work offline after first load. No backend business logic required for MVP; future sync is explicitly deferred. Deploy target is a personal nginx server serving static files.

## Decision
Build the app as a static website + Progressive Web App:
- Service worker caches the app shell.
- Dataset cached in IndexedDB after first load (see ADR-0004).
- Installable via Web App Manifest + icons.
- No push notifications.

## Consequences
- No server runtime in MVP; nginx serves static `dist/` only.
- Offline-first; full functionality after initial dataset fetch.
- Future sync (deferred) will require adding a backend without rewriting the client.
