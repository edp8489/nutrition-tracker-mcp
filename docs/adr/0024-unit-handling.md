# ADR 0024 — Unit handling: metric storage, imperial/household input

Date: 2026-09-13
Status: Accepted — amends ADR-0006

## Context
ADR-0006 restricted inputs to g/ml, deferring imperial support. Real usage — app and LLM chat — contains mixed input: "3 oz chicken breast", "1 lb chicken", "1 cup rice". The dataset stores metric only and carries per-food household servings (`serving.common`) that anchor cups, eggs, etc. to grams (ADR-0023). A density-table approach was rejected as inaccurate and ungrounded.

## Decision
- **Storage stays metric-only**: recipe ingredients and log entries continue to store `{ quantity, unit: 'g' | 'ml' }`, normalized at input time. Metric remains the single source of truth; the raw imperial/household input is not persisted (edits show the normalized metric value).
- **Input accepts metric, imperial, and household units**:
  - Pure unit conversions (oz, lb, fl oz ↔ g/ml) use **js-quantities** — the same library in the app frontend and the MCP server. The earlier `pint` assumption is dropped with the Python runtime (ADR-0020).
  - Household/count units ("1 cup rice", "2 large eggs") convert via the **food's own serving anchor**: the ratio of `servingMetric` to `servingCommon` (ADR-0023). No density tables, ever.
  - A food without a matching `servingCommon` returns "no household serving defined — provide grams" (server) / a grams-only picker (app).
- **Conversion happens at the boundary**: the app converts before persisting; MCP tools accept unit parameters and normalize server-side. The model never multiplies.
- **App UI**: the quantity field gains a unit selector (g, ml, oz, lb, fl oz, plus the food's common serving when defined), defaulting to `servingMetric`.

## Consequences
- ADR-0006's "metric-only input" consequence is superseded; its metric-storage decision stands, and the dataset remains untouched.
- `unit_conversion` becomes a v1 task type backed by the `convertUnits` tool and the anchors above (ADR-0020).
- Anchor-based conversion is per-food and data-grounded: "1 cup" of different foods yields their own dataset gram values, not a generic density guess.