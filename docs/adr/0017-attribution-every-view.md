# ADR 0017 — Attribution on every data-displaying view

Date: 2026-08-24
Status: Accepted

## Context
OpenNutrition dataset README requires attribution on **every page/screen where data is displayed**, and explicitly states consolidated attribution (one location only) does not satisfy the license. The app displays dataset data on Recipes, Log, and Reports views.

## Decision
- Render a persistent attribution footer/component on **Recipes**, **Log**, and **Reports** views: "Data: [OpenNutrition](https://www.opennutrition.app)" + "(c) Open Food Facts contributors" link.
- An **About** view carries the full ODbL + DbCL license text and attribution details.
- PWA manifest / store listing (if ever published) will include attribution.

## Consequences
- Footer component reused across three views; small layout cost.
- Cannot be dismissed or hidden by the user.
