# ADR 0006 — Metric units only (g for solids, ml for liquids)

Date: 2026-08-24
Status: Accepted

## Context
Unit conversion adds complexity. Personal use; metric is sufficient.

## Decision
MVP accepts quantities in grams (solids) and milliliters (liquids) only. Imperial units, cups/oz, and dataset-native serving-unit conversion are deferred.

## Consequences
- Simpler input UI: numeric field + unit toggle (g/ml).
- Recipe and log schemas store `{ quantity: number, unit: 'g' | 'ml' }`.
- Future imperial support will require a conversion layer and may need density data for volume→mass.
