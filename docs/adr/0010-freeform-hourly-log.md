# ADR 0010 — Freeform hourly log entries (no meal slots)

Date: 2026-08-24
Status: Accepted (amended 2026-09-16: timestamp granularity changed from hour to nearest 15 minutes)

## Context
Owner logs meals at arbitrary times; fixed meal slots (breakfast/lunch/dinner/snack) are unnecessarily rigid. Loose timestamps grouped by hour are sufficient.

## Decision
- Log entries are a freeform list, each with a loose timestamp delineated to the quarter hour (date + HH:MM, nearest 15 minutes).
- No fixed meal slots or meal-type field.
- Free edit and delete of any past entry.

## Consequences
- Schema: `LogEntry { id, timestamp: ISOString (15-minute precision), foodRef? | recipeRef?, snapshot: Macros, quantity, unit }`.
- UI groups entries by date, optionally by time within a day.
- Reports aggregate by calendar day (local timezone).
