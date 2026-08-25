# ADR 0013 — Deploy path: `/nutrition-tracker/` subpath on personal nginx

Date: 2026-08-24
Status: Accepted

## Context
App deployed on a personal nginx server at a subpath, not a dedicated subdomain. Data chunks served from the same origin under a `data/` path.

## Decision
- Vite `base: '/nutrition-tracker/'`.
- Vue Router `createWebHistory('/nutrition-tracker/')`.
- App served at `https://<host>/nutrition-tracker/`.
- Data chunks at `https://<host>/nutrition-tracker/data/chunks/*.jsonl` and `/nutrition-tracker/data/manifest.json`.
- nginx `location /nutrition-tracker/ { root <dist-parent>; try_files $uri /nutrition-tracker/index.html; }`.
- Same origin → no CORS configuration.

## Consequences
- All asset URLs are subpath-relative.
- PWA manifest `start_url` and `scope` must include the subpath.
- Service worker registration path = `/nutrition-tracker/sw.js`.
