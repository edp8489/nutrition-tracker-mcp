# ADR 0002 — Frontend stack: Vue 3 + Vite + TypeScript + beerCSS + Pinia + Vue Router

Date: 2026-08-24
Status: Accepted

## Context
Minimal UI, personal project. Need a reactive SPA with three top-level views (Recipes, Log, Reports). beerCSS chosen for Material-style components.

## Decision
- Vue 3 (Composition API) + Vite + TypeScript.
- beerCSS via npm package.
- Pinia for state management.
- Vue Router with three top-level routes: `/recipes`, `/log`, `/reports`.
- Chart.js + vue-chartjs for graphs (see ADR-0007).

## Consequences
- Standard, well-documented stack; small bundle.
- beerCSS does not ship charts or data tables beyond basic styling; we build table + chart views ourselves.
- Pinia stores act as the reactive layer over Dexie queries (see ADR-0003).
