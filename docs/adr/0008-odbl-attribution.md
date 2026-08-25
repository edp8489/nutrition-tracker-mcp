# ADR 0008 — ODbL attribution and derivative dataset handling

Date: 2026-08-24
Status: Accepted

## Context
OpenNutrition dataset is licensed under the Open Database License (ODbL). ODbL requires attribution and share-alike of derivative databases. App is non-commercial; owner intends to provide free access eventually and does not plan to expand the ingredient database.

## Decision
- Add an **About / Data attribution** view in the app linking to OpenNutrition and the ODbL notice.
- Treat the dataset extract stored in IndexedDB (and the chunked backend copy) as a **derivative database** under ODbL: maintain attribution, keep the derivative under ODbL.
- The application *code* is separate from the *dataset*; ODbL share-alike applies to the dataset extract, not the app code.
- No legal review engaged for MVP; reconfirm before any public release.

## Consequences
- Attribution must persist across releases (UI + dataset manifest).
- Any future redistribution of the dataset chunks must preserve ODbL terms.
