# Implementation Plan: Google Drive Cloud Synchronization

**Branch**: `001-gdrive-cloud-sync` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-gdrive-cloud-sync/spec.md` with user constraints:
- Debouncing using `lodash/debounce` (10s)
- Authentication via Google Identity Services (GIS) with pre-registered Google Cloud project
- Reusable architecture across frontends (Genshin first)
- Unified atomic backup for all 4 slots in user's hidden Google Drive `appDataFolder`
- Conflict resolution dialog with size/timestamp comparison and severe disparity warning

---

## Summary

Implement client-side cloud synchronization for Genshin Optimizer by integrating Google Identity Services (GIS) and the Google Drive REST API v3 with the least-privilege `drive.appdata` scope. All 4 database slots are bundled into a single unified JSON archive and stored directly in the user's hidden personal Drive application folder (zero project server costs and complete user data privacy). Mutations across any slot trigger a 10-second debounce timer powered by `lodash/debounce`. The system automatically checks for updates on initial window focus, provides persistent login across page refreshes, and presents an interactive Conflict Resolution dialog with disparity warnings whenever divergent edits occur. The core engine is architected as an isolated, game-agnostic library (`libs/common/gdrive` and `libs/common/gdrive-ui`) allowing future frontends (Star Rail, ZZZ) to plug in seamlessly.

---

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node.js 20+, React 18.3.1  
**Primary Dependencies**:
- `@genshin-optimizer/common/database` & `@genshin-optimizer/common/database-ui`
- `@mui/material` & `@emotion/styled`
- `lodash.debounce` (or `lodash/debounce`) with `@types/lodash.debounce`
- Google Identity Services (GIS) Web Client (`https://accounts.google.com/gsi/client`)
- Google Drive REST API v3 (REST endpoints for `appDataFolder`)
- `react-i18next` for internationalization

**Storage**:
- Cloud: User's personal Google Drive Application Data Folder (`appDataFolder`) via `https://www.googleapis.com/auth/drive.appdata`
- Local: Browser `localStorage` for authentication tokens (`gdrive_auth_session`), sync state metadata (`gdrive_sync_metadata`), and existing local database slot storage

**Testing**:
- Vitest (`@nx/vitest`) for unit and integration testing of the sync manager, debounce wrapper, and conflict detector
- `@testing-library/react` for UI component testing

**Target Platform**: Modern Web Browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Nx Monorepo shared libraries + game frontend integration  
**Performance Goals**:
- Debounce window: exactly 10,000ms after last mutation
- Silent token validation/refresh on startup: < 1.5s
- Immediate cloud push upon "Keep Local Data" conflict choice: < 2.0s
- Zero UI jank or main-thread freezing during multi-slot JSON packaging

**Constraints**:
- Strictly zero project-hosted backend or proxy servers
- Minimum required OAuth permission (`drive.appdata` only; 0 access to user documents)
- Atomic multi-slot payload (all 4 slots persisted together)
- Full localization compliance: 0 hardcoded UI strings
- Complete quality gate compliance with `yarn run mini-ci`

**Scale/Scope**: 4 database slots per frontend; JSON archive size typically 500KB - 5MB

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evaluation & Architectural Guarantee |
| :--- | :---: | :--- |
| **I. Library-First Monorepo Architecture** | **PASS** | The Google Identity client, Drive API client, debounce orchestrator, and conflict dialog are isolated in `libs/common/gdrive` and `libs/common/gdrive-ui`. Frontends (`apps/frontend`) and settings (`libs/gi/page-settings`) consume these through public entry points without any deep cross-module imports. |
| **II. Pure & Deterministic Calculation Engines** | **PASS** | Hashing algorithms, payload serializations, debounce controllers, and disparity calculation heuristics are implemented purely and deterministically, fully covered by Vitest unit test suites without browser or DOM coupling. |
| **III. Strict Quality Gates (mini-ci)** | **PASS** | All new modules satisfy Biome formatting and linting, strict TypeScript typechecking, and Vitest unit testing. Verified via `yarn run mini-ci`. |
| **IV. Standardized Interoperability & Data Integrity** | **PASS** | Payloads preserve existing slot structures and GOOD export compatibility. Payloads are validated prior to overwriting local storage, and destructive overwrites during conflicts require explicit user confirmation. |
| **V. Internationalization (i18n) & Localized UI** | **PASS** | All user-facing text (card labels, status chips, conflict dialog explanations, disparity warnings, action buttons) are defined in `libs/gi/localization/assets/locales/en/settings.json` and loaded via `useTranslation()`. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-gdrive-cloud-sync/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan
├── research.md          # Technical decisions and rationale (Phase 0)
├── data-model.md        # Schemas and state transitions (Phase 1)
├── quickstart.md        # Runnable verification guide (Phase 1)
├── contracts/           # Component and API contracts (Phase 1)
│   ├── gdrive-client.contract.md
│   ├── sync-manager.contract.md
│   └── conflict-dialog.contract.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
libs/
├── common/
│   ├── gdrive/                          # NEW: Reusable Google Drive & sync library
│   │   ├── src/
│   │   │   ├── GoogleIdentityClient.ts   # GIS token client & silent refresh
│   │   │   ├── GoogleDriveApiClient.ts   # Drive REST API v3 appDataFolder client
│   │   │   ├── CloudSyncManager.ts       # 10s debouncer, trigger listener, state machine
│   │   │   ├── conflict.ts               # Conflict detection & disparity heuristic
│   │   │   ├── types.ts                  # Schemas & interfaces
│   │   │   └── index.ts                  # Public package entry point
│   │   ├── project.json
│   │   └── tsconfig.json
│   │
│   └── gdrive-ui/                       # NEW: Reusable UI & React hooks
│       ├── src/
│       │   ├── hooks/
│       │   │   ├── useCloudSync.ts       # React hook for sync status & actions
│       │   │   └── index.ts
│       │   ├── components/
│       │   │   ├── ConflictDialog.tsx    # Modal dialog with disparity warning
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── project.json
│       └── tsconfig.json
│
├── gi/
│   ├── db-ui/                           # Existing Genshin database UI library
│   │   └── src/
│   │       ├── gdrive/
│   │       │   ├── GenshinSlotAdapter.ts # Adapts Genshin's 4 ArtCharDatabases to sync package
│   │       │   └── index.ts
│   │
│   ├── page-settings/                   # Existing Genshin Settings page library
│   │   └── src/
│   │       ├── CloudSyncCard.tsx         # Settings card UI for login/sync status
│   │       └── index.tsx                 # Injects CloudSyncCard into settings layout
│   │
│   └── localization/
│       └── assets/locales/en/
│           └── settings.json             # English i18n keys for cloud sync & conflict dialog
│
└── tsconfig.base.json                   # Path mappings for @genshin-optimizer/common/gdrive
```

**Structure Decision**:
Following Constitution Principle I, core cloud synchronization logic is split into generic reusable libraries (`@genshin-optimizer/common/gdrive` and `@genshin-optimizer/common/gdrive-ui`), while Genshin-specific slot adaptation and UI integration are placed in `@genshin-optimizer/gi/db-ui` and `@genshin-optimizer/gi/page-settings`. This enables immediate reuse for `sr-frontend` and `zzz-frontend` without rewriting any Google Identity, Drive, debounce, or conflict dialog code.

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. Design strictly complies with all constitutional principles and architectural constraints.*
