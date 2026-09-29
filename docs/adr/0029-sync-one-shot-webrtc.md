# ADR 0029 — Sync: one-shot full-state merge over WebRTC/PeerJS

Date: 2026-09-26

## Context

v1.x goal: sync recipes and log data across devices (e.g. phone browser ↔ desktop browser) without accounts and without user data in a server database. The model mimics file.pizza: peer-to-peer transfer via the PeerJS library. This ADR settles the architecture now so v1.1's export/import format (ADR-0027) is compatible from day one.

## Decision

- **One-shot full-state merge**, permanently: a sync session connects two devices, exchanges full state, applies `merge()` (ADR-0027) to converge, and disconnects. The user picks direction (send/receive or "sync now" on both). **Continuous convergence sync is rejected and will never be implemented** — no change events, ordering logic, reconnect handling, or background sync.
- **Wire payload = export format** (ADR-0027). Sync is a transport problem only; `merge()` is the single conflict-resolution point.
- **Signaling**: PeerJS public cloud broker for the public/demo deployment. The broker relays SDP offers only — no user data touches it; data flows P2P via WebRTC. A self-hosted `peerjs-server` is supported as an optional separate service in the docker-compose template.
- **Pairing UX**: generate a short room-style ID; the other device opens the same URL with `?sync=<id>`.
- **Statelessness preserved**: no accounts, no server-side user database (ADR-0009 upheld).

## Consequences

- Sync shares the serialization seam: `serialize()` + `merge()` from `shared/serialization/` serve import, server recipes, and sync.
- Conflict resolution evolves in one place; sync tests reuse merge unit tests.
- Large data volumes on slow links are a v1.x implementation concern (chunking/streaming may be needed); format unchanged either way.
- Broker reliability risk accepted for demo; self-host escape hatch documented.
