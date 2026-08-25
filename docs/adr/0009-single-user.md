# ADR 0009 — Single-user, single-device for MVP (no identity, no sync)

Date: 2026-08-24
Status: Accepted

## Context
Primary user is the owner. Sync across devices, E2E encryption, and a minimal backend for sync are all explicitly deferred. Adding `userId`/`deviceId` placeholders now would be speculative.

## Decision
MVP is single-user, single-device, no auth, no identity fields in the schema. Future sync will be introduced via a schema migration that adds identity at that time.

## Consequences
- No auth surface; simpler schema.
- Future sync requires a migration (acceptable; deferred feature).
- No placeholder columns in tables (YAGNI).
