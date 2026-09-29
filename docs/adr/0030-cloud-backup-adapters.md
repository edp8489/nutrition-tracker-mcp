# ADR 0030 — Cloud backups via BackupAdapter seam, frontend-only OAuth

Date: 2026-09-26

## Context

v1.x goal: allow backups to cloud storage providers (Dropbox, Google Drive, Microsoft OneDrive) via provider-native APIs, without backend support for storing user login credentials.

All three providers support pure-frontend SPA OAuth flows: Dropbox (PKCE), Google Drive (Google Identity Services token client, requires a registered client ID with authorized JavaScript origins), OneDrive (MSAL.js, requires an Azure app registration). No backend credential storage is needed for any of them.

## Decision

- **`BackupAdapter` interface** (the seam):

  ```ts
  interface BackupAdapter {
    listBackups(): Promise<BackupMeta[]>
    saveBackup(payload: ExportFile): Promise<void>
    restoreBackup(id: string): Promise<ExportFile>
  }
  ```

- **Adapter order**: local-download (implemented in v1.1 as part of ADR-0027 export), then **Dropbox and Google Drive** in v1.x. **OneDrive deferred** to a later release.
- **Two adapters minimum before the seam is "real"**: local-download ships first as the reference adapter; Dropbox/Drive follow. The interface is defined in v1.x work, not speculatively earlier.
- **Google Drive constraint accepted**: GIS access tokens live ~1 hour; backup upload must complete within token lifetime. Acceptable because backup is a conscious user action with an immediate upload — no background sync, no offline refresh (that would require a backend).

## Consequences

- Adding a provider = writing one adapter; the Backup view never changes.
- OAuth client IDs/registrations are per-deployment configuration (developer-registered apps with authorized origins).
- No credentials ever reach the MCP server; its statelessness (ADR-0020) is preserved.
- Restore path reuses `merge()` (ADR-0027) — cloud restore behaves exactly like file import.
