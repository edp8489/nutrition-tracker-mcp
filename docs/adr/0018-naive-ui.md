# ADR 0018 — UI framework: Naive UI (replaces BeerCSS)

Date: 2026-09-10
Status: Accepted

## Context
BeerCSS (ADR-0002) provides Material-style CSS classes only. It ships no data tables, dialogs, date pickers, or form validation, so table + form views had to be hand-built (noted in ADR-0002's consequences). The project pivoted to a richer Vue-3-native component library.

## Decision
- Replace BeerCSS with **Naive UI** (`naive-ui` npm package): TypeScript-first, Vue 3 native, tree-shakable.
- Components are mounted under `n-config-provider` for global theming.
- Light theme is the default; a dark-theme toggle lives in user preferences. The preference is device-local (persisted in localStorage), consistent with ADR-0009.
- Chart.js colors are configured to match the active Naive UI theme (supersedes the beerCSS-matching note in ADR-0007).

## Consequences
- Partially supersedes ADR-0002 (UI-library clause only; Vue/Vite/TypeScript/Pinia/Router decisions unchanged).
- Supersedes the "custom theming to match beerCSS Material look" consequence of ADR-0007.
- Bundle grows relative to BeerCSS, mitigated by Naive UI's tree-shaking.
- Code scaffold changes (main.ts imports, AboutView tech list, package.json) are tracked as follow-up work; docs land first.