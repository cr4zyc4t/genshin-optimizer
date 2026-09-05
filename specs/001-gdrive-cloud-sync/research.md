# Research: Google Drive Cloud Synchronization

**Feature**: Google Drive Cloud Synchronization
**Branch**: `001-gdrive-cloud-sync`
**Date**: 2026-09-05
**Spec**: [spec.md](./spec.md)

This document resolves all technical decisions, architecture choices, and integration patterns for implementing client-side Google Drive cloud synchronization.

---

## Decision 1: Authentication Engine & Token Management

### Context
Users must authenticate with Google to grant access to their personal Google Drive without exposing any backend credentials or requiring a custom authentication server. The user requested: "use Google Identity Services for login, I already register a project on Google cloud for this" and "login must persist on browser refresh".

### Decision
Use **Google Identity Services (GIS) Token Client** (`google.accounts.oauth2.initTokenClient`) configured with the client-side OAuth 2.0 Implicit Token flow.
- The GIS JavaScript SDK is dynamically loaded (`https://accounts.google.com/gsi/client`).
- The authorization scope is strictly restricted to: `https://www.googleapis.com/auth/drive.appdata` (and optionally `https://www.googleapis.com/auth/userinfo.profile` / `https://www.googleapis.com/auth/userinfo.email` for user profile info).
- Credentials persistence:
  - Cache active token metadata (`access_token`, `expires_at`, `user_profile`) in browser `localStorage`.
  - On application startup or browser refresh, inspect `expires_at`:
    - If current time < `expires_at`, restore authentication state immediately without blocking user experience.
    - If expired or near expiration, trigger a silent re-authorization using `tokenClient.requestAccessToken({ prompt: '' })`.
    - If silent refresh fails (e.g. session expired or third-party cookie restrictions), transition state to `DISCONNECTED` / `EXPIRED`, displaying a "Session Expired - Reconnect" button on `CloudSyncCard`.
- Google Client ID is configured via environment variable `process.env.NX_GOOGLE_CLIENT_ID` with an optional settings override.

### Rationale
- Standard modern Google-recommended authentication method for Single Page Applications (SPAs) without a dedicated backend server.
- Completely avoids legacy Google Sign-In (`gapi.auth2`), which has been deprecated and sunsetted.
- Satisfies zero-cost serverless project requirement: auth operates purely between the user's browser and Google servers.

### Alternatives Considered
- **OAuth 2.0 Authorization Code Flow with PKCE**: Requires a redirect endpoint or backend proxy to exchange authorization codes for refresh tokens. Overcomplicates a static SPA architecture and requires hosting infrastructure.
- **Firebase Authentication / Supabase**: Introduces a third-party hosted database or user table, violating the requirement that data belongs purely in the user's Google Drive and not on project servers.
- **Legacy `gapi.auth2`**: Deprecated by Google; GIS is the modern, supported successor.

---

## Decision 2: Cloud Storage Target & Google Drive API Scope

### Context
The user specified: "data is stored in drive of user, not project", "data in cloud is hidden from user", and "grant just enough permission for cloud syncing when login".

### Decision
Store all cloud sync files inside the **Google Drive Application Data Folder** (`appDataFolder`) using Google Drive REST API v3 with the restricted OAuth scope:
`https://www.googleapis.com/auth/drive.appdata`
- Endpoint URL: `https://www.googleapis.com/drive/v3/files` and `https://www.googleapis.com/upload/drive/v3/files`
- Search query: `spaces=appDataFolder&q=name='genshin_optimizer_sync.json' and trashed=false`
- File create: Multipart upload targeting `'parents': ['appDataFolder']`
- File update: `PATCH /upload/drive/v3/files/{fileId}?uploadType=media`
- File get: `GET /drive/v3/files/{fileId}?alt=media`

### Rationale
- **Complete Privacy & Isolation**: Files in `appDataFolder` are stored directly in the user's Google Drive account, counting towards their own storage quota rather than any project quota.
- **Hidden from User Browsing**: Files in `appDataFolder` are not visible in standard Google Drive UI (drive.google.com folder views or searches), protecting sync archives from accidental deletion, tampering, or folder clutter.
- **Least-Privilege Security**: The `drive.appdata` scope grants access *only* to files created by the application within that hidden folder. It grants zero permissions to view, list, read, or modify any personal documents, spreadsheets, photos, or files in the user's main Drive.

### Alternatives Considered
- **Google Drive Root Folder (`drive.file` scope)**: Would place `genshin_optimizer_sync.json` directly into the user's visible Drive root. Users might delete, move, or rename it, breaking synchronization and cluttering personal files.
- **Full Google Drive Access (`drive` scope)**: High security risk, triggers alarming Google security warnings during consent ("This app can see, edit, create, and delete all of your Google Drive files"), violating least-privilege principles.

---

## Decision 3: Debouncing Mechanism for Data Mutations

### Context
The user specified: "sync trigger must be debounced 10s" and "use lodash debounce for debouncing sync".

### Decision
Use `lodash/debounce` (or `lodash.debounce`) to wrap the sync execution method with a wait time of 10,000 milliseconds (10s).
- Maintain the debounced function reference across component lifecycles using a persistent sync manager service instance or a React ref.
- The debounced function exposes:
  - `.call()`: Resets the 10-second countdown on every data mutation across all database slots.
  - `.cancel()`: Clears the pending timer on component unmount or logout.
  - `.flush()`: Executes the pending synchronization immediately (utilized when a user resolves a conflict by choosing "Keep Local Data").

### Rationale
- `lodash.debounce` is the industry-standard, rock-solid, well-tested implementation of debounce with cancellation and immediate flush capabilities.
- Prevents network thrashing, rate-limiting, or high API quota consumption when users make rapid bulk edits (e.g. importing artifacts or adjusting build loadouts).

### Alternatives Considered
- **Custom `setTimeout` implementation**: Prone to memory leaks, edge cases around cancellation, and lacks clean `flush()` / `cancel()` semantics.
- **RxJS / Observable debounceTime**: Would introduce heavy RxJS dependencies into a codebase that relies primarily on React state and standard event listeners.

---

## Decision 4: Unified Multi-Slot Payload Architecture

### Context
The user specified: "all 4 slots are sync as one data file" and "this time, we implement cloud sync for Genshin only, but aware that it can be integrate with other frontend in the future, so design it to be reusable."

### Decision
Define a versioned, portable archive format named `UnifiedSyncPackage`:
```typescript
interface UnifiedSyncPackage<SlotData = unknown> {
  version: 1
  appId: string // e.g. "genshin-optimizer" | "star-rail-optimizer"
  createdAt: number // Unix timestamp (ms)
  clientRevision: string // UUID or hash of content
  slots: Record<number, {
    name: string
    lastEdit: number
    data: SlotData
  }>
}
```
- In Genshin Optimizer, all 4 slots (1, 2, 3, 4) are read from local database instances and serialized together into this single JSON payload.
- Deserialization unpacks all 4 slots and updates the local storage instances in a single coordinated transaction.
- Generic interface allows Star Rail (`sr-frontend`) or ZZZ (`zzz-frontend`) to reuse the packaging structure simply by specifying their respective `appId` and slot serializers.

### Rationale
- Atomic updates: Users don't experience partial sync where slot 1 is from device A and slot 2 is from device B.
- Schema versioning (`version: 1`) guarantees backward compatibility and enables future migrations.

### Alternatives Considered
- **Separate file per slot (`slot_1.json`, `slot_2.json`, ...)**: Quadruples API calls, introduces partial sync inconsistencies, and makes conflict detection significantly more complex.
- **Binary/Gzip Compression in Drive**: While `fflate` could compress JSON, Google Drive handles compression on its HTTP transport layer (gzip/br). Storing JSON directly simplifies debugging and inspection.

---

## Decision 5: Conflict Detection & Resolution Strategy

### Context
The user specified: "when there is conflict, show user a dialog to choose between local data or cloud data with some useful information like last modify times, size. Has a warning if 1 data is much smaller than the other. If user choose local data, trigger sync immediately to make cloud data up to date".

### Decision
Implement three-way timestamp and revision tracking:
1. **Sync Anchor**: Record `lastSyncTimestamp` and `lastRemoteModifiedTime` upon every successful sync.
2. **Conflict Trigger Condition**:
   - Remote file `modifiedTime` on Drive > `lastRemoteModifiedTime` (indicating remote edits have occurred).
   - Local database `lastEditTime` > `lastSyncTimestamp` (indicating local edits have occurred).
   - When both conditions are met, trigger the `CONFLICT` state.
3. **Disparity Warning Heuristic**:
   - Compare payload sizes and slot item totals (e.g. total characters + artifacts + weapons):
   - If `Math.abs(localSize - remoteSize) / Math.max(localSize, remoteSize) > 0.25` or item count difference > 20%, display an emphasized warning badge in the dialog:
     *"Warning: The local data is significantly smaller than the cloud backup (or vice versa). Selecting the smaller version may result in loss of builds, artifacts, or characters."*
4. **Immediate Flush on Local Choice**:
   - When user clicks "Keep Local Data", cancel debounce and call `.flush()` / `forceUpload()` immediately, updating the cloud file in < 2 seconds.
5. **Atomic Overwrite on Cloud Choice**:
   - When user clicks "Use Cloud Data", write the cloud slot contents into local storage and reload the database contexts.

### Rationale
- Protects users against data loss across multi-device scenarios.
- High-visibility disparity warning specifically targets the most dangerous failure mode: overwriting an established profile with an empty or reset slot.

### Alternatives Considered
- **Automatic "Last-Write-Wins" (LWW)**: Silently overwrites newer or older data without user consent. Unacceptable for theorycrafting tools where users invest hundreds of hours tuning builds.
- **Automatic Deep Object Merging**: Merging divergent artifact databases with conflicting IDs or conflicting equipped states is mathematically non-deterministic and can produce corrupted game states. Interactive resolution is the gold standard.

---

## Decision 6: Monorepo Architecture & Reusability Breakdown

### Context
Constitution Principle I enforces library-first architecture. The feature must be implemented for Genshin first, but designed to be easily consumed by Star Rail (`sr`), ZZZ (`zzz`), or Somnia.

### Decision
Split implementation across libraries:
1. **`libs/common/gdrive`**:
   - Pure TypeScript library.
   - `GoogleIdentityClient`: Handles GIS loading, token requests, silent refreshes, and profile fetching.
   - `GoogleDriveApiClient`: REST API client for `appDataFolder` (search, read, multipart create, update).
   - `CloudSyncManager`: Generic state machine, 10s debouncer (`lodash/debounce`), conflict detector, and sync orchestrator.
2. **`libs/common/gdrive-ui`** (or within `libs/common/database-ui`):
   - Reusable React UI components and hooks:
     - `useCloudSync`: React hook providing sync status, account info, and manual trigger controls.
     - `ConflictDialog`: MUI dialog with comparative metrics and disparity warning.
3. **`libs/gi/db-ui` / `libs/gi/page-settings`**:
   - Genshin-specific slot adapter: Serializes Genshin's 4 `ArtCharDatabase` slots into `UnifiedSyncPackage`.
   - `CloudSyncCard.tsx`: Settings UI card integrated into Genshin Optimizer's `PageSettings`.

### Rationale
- 100% compliant with Constitution Principle I (Library-First Monorepo Architecture).
- Star Rail or ZZZ can integrate cloud sync in the future by writing ~50 lines of slot adapter code without duplicating any GIS, Drive, debouncing, or conflict UI logic.

### Alternatives Considered
- **Building everything directly inside `apps/frontend`**: Violates Constitution Principle I; prevents code reuse across frontends.
- **Putting all logic into `libs/gi/page-settings`**: Couples Google Drive sync to Genshin Optimizer, preventing other games from adopting it.
