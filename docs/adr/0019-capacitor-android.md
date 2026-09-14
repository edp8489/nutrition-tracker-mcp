# ADR 0019 — Capacitor for Android packaging; desktop deferred (Wails preferred)

Date: 2026-09-10
Status: Accepted — amended by ADR-0022: Android consumes the MCP tool library in-process with on-device SQLite (subset seed + optional chunk import); amended by ADR-0021: Wails desktop preference dropped — desktop is covered by the personal web app

## Context
Pivot to native distribution. Capacitor wraps the existing Vue web build in a native shell. Desktop targets via `@capacitor-community/electron` were rejected (community-maintained, patchy release cadence); Tauri was rejected (no Rust experience). A Go-based desktop shell (Wails) is preferred but deferred until the Android app exists.

## Decision
- **Capacitor packages the Android app**; the web PWA (ADR-0001, ADR-0013) remains a first-class distribution channel.
- Per-platform build config:
  - Web: Vite `base: '/nutrition-tracker/'`, history-mode router (ADR-0013 unchanged).
  - Android: Vite `base: '/'`, hash-mode router. Divergence is build config only.
- Service-worker registration is guarded to web only (skipped when `Capacitor.isNativePlatform()`); the web manifest stays for the PWA. WebView assets are already local — a service worker is pointless in the native shell.
- Dataset delivery on Android is unchanged from ADR-0004: subset bundled in the app package, chunks lazy-fetched from nginx on demand or via a manual "download full dataset" action, cached in IndexedDB.
- Distribution: sideloaded APK only. No Play Store listing. F-Droid is a possible future channel once app-code licensing is resolved (see PRD open items).

## Consequences
- Each install (web, Android, future desktop) holds an independent data island; sync stays deferred (ADR-0009 unchanged).
- Adds the Capacitor CLI and Android toolchain to the dev workflow.
- Desktop remains undecided: a future ADR is expected to choose Wails (Go), which would bundle the full dataset chunk set instead of remote fetching (platform split noted in ADR-0004).
- Android chunk fetches require the personal nginx to be reachable on demand; already-cached chunks remain available offline.