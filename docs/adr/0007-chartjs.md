# ADR 0007 — Chart.js + vue-chartjs for macro graphs

Date: 2026-08-24
Status: Accepted — beerCSS-theming consequence superseded by ADR-0018 (Chart.js follows the active Naive UI theme)

## Context
MVP needs a stacked-bar week view of macros (protein/carbs/fat) per day. beerCSS ships no charts. User excludes Bokeh and Plotly; otherwise no preference.

## Decision
Use **Chart.js** with the **vue-chartjs** wrapper. Mature, small, fits the stacked-bar requirement.

## Consequences
- Bundle adds ~Chart.js (~60KB gz) — acceptable.
- Micronutrient graphs (deferred) can reuse the same library.
- Custom theming needed to match beerCSS Material look.
