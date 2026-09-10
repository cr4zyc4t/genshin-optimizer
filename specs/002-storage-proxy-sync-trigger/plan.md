# Implementation Plan: Storage Proxy Synchronization Trigger

**Branch**: `002-storage-proxy-sync-trigger` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-storage-proxy-sync-trigger/spec.md` with user requirements:
- Use `LocalStorageProxy` (commit `9328a822d19c7a119db70788f1e6df43b739306c`) for detecting data change.
- Cloud sync triggers whenever data in `localStorage` changes by listening on: `clear`, `setItem`, `removeItem`.
- Blacklist of ignored keys for `setItem` and `removeItem` (exact keys + prefix patterns) to avoid sync loops and skip non-database keys.
- Preserve debounce (5s) and maxWait (8s) timing.
- Revert old database layer / UI timestamp patches as close as possible to branch `origin/customize`.

---

## Summary

Refactor the cloud synchronization change detection and trigger mechanism from fragile database-layer hooks and UI card timestamp patches to persistent storage write interception via `LocalStorageProxy`. Mutation events (`setItem`, `removeItem`, `clear`) are observed inside `GenshinSlotAdapter.subscribeToChanges` via `addGlobalStorageWriteListener`. A hybrid exclusion filter (`exactKeys: Set` + `prefixPatterns: string[]`) ignores sync metadata (`gdrive_*`) and non-database UI preferences (`snow`, `silly`, `newTabKey`, `infoShown_*`), preventing infinite sync loops and unwanted uploads. The existing debounce (5000ms) and maxWait (8000ms) timing logic in `CloudSyncManager` is preserved as-is. Ad-hoc timestamp updates in `DatabaseCard.tsx` and `UploadCard.tsx` as well as deep database manager listener loops in `GenshinSlotAdapter.ts` are eliminated, cleanly restoring the code back to the `origin/customize` baseline.

---

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node.js 20+, React 18.3.1  
**Primary Dependencies**:
- `@genshin-optimizer/common/database` (`LocalStorageProxy`, `installLocalStorageProxy`, `addGlobalStorageWriteListener`)
- `@genshin-optimizer/common/gdrive` (`CloudSyncManager`, `MultiSlotDataAdapter`)
- `@genshin-optimizer/gi/db-ui` (`GenshinSlotAdapter`)
- `@genshin-optimizer/gi/ui` (`DatabaseCard`, `UploadCard`)
- `lodash.debounce` with `@types/lodash.debounce`

**Storage**:
- Cloud: Google Drive Application Data Folder (`appDataFolder`) via Drive REST API v3
- Local: Browser `localStorage` intercepted by `LocalStorageProxy`

**Testing**:
- Vitest (`@nx/vitest`) for unit testing `GenshinSlotAdapter`, `LocalStorageProxy`, and `CloudSyncManager`

**Target Platform**: Modern Web Browsers (Chrome, Firefox, Safari, Edge)  
**Project Type**: Nx Monorepo shared libraries + game frontend integration  
**Performance Goals**:
- Blacklist check: < 1µs per storage write
- Debounce window: exactly 5,000ms after last mutation (capped at 8,000ms max wait)
- Zero main-thread blocking or perceptible latency during write interception

**Constraints**:
- Strictly zero infinite sync loops during sync saves or remote imports
- 100% preservation of all database slot changes without missing edits
- Revert ad-hoc UI timestamp patches (`DatabaseCard.tsx`, `UploadCard.tsx`) to match `origin/customize`
- Pass `yarn run mini-ci` (Biome format/lint, strict TypeScript typechecking, Vitest suites)

**Scale/Scope**: 4 database slots, dozens of character/artifact records per slot

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evaluation & Architectural Guarantee |
| :--- | :---: | :--- |
| **I. Library-First Monorepo Architecture** | **PASS** | Storage proxy change detection is encapsulated in `libs/gi/db-ui` (`GenshinSlotAdapter`) consuming `@genshin-optimizer/common/database`. The cloud sync engine (`libs/common/gdrive`) remains decoupled and platform-agnostic. UI apps remain thin composition layers. |
| **II. Pure & Deterministic Calculation Engines** | **PASS** | No damage formulas, stat nodes, or calculation graphs are modified. Blacklist evaluation is a pure, side-effect-free predicate. |
| **III. Strict Quality Gates (mini-ci)** | **PASS** | All modified files must satisfy Biome linting, TypeScript typechecking, and unit test suites via Vitest. |
| **IV. Standardized Interoperability & Data Integrity** | **PASS** | GOOD export and import compatibility remains untouched. Intercepting writes at the storage layer guarantees that slot swaps and bulk imports are captured reliably. |
| **V. Internationalization (i18n) & Localized UI** | **PASS** | No new user-facing strings are introduced. Status labels and UI text remain strictly managed via existing i18n bundles. |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-storage-proxy-sync-trigger/
├── spec.md              # Feature specification with clarifications
├── plan.md              # This implementation plan
├── research.md          # Technical decisions and rationale (Phase 0)
├── data-model.md        # Entities, events, and lifecycle diagrams (Phase 1)
├── quickstart.md        # Runnable verification guide (Phase 1)
├── contracts/           # Interface and filter contracts (Phase 1)
│   ├── slot-adapter.contract.md
│   └── storage-filter.contract.md
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code (repository root)

```text
libs/
├── common/
│   ├── database/
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── LocalStorageProxy.ts      # Storage write interception & event bus
│   │       │   └── LocalStorageProxy.test.ts # Proxy unit tests
│   │       └── index.ts                      # Public exports
│   │
│   └── gdrive/
│       └── src/
│           ├── CloudSyncManager.ts           # Debounced sync orchestrator & isApplyingRemote guard
│           └── adapter.ts                    # MultiSlotDataAdapter interface
│
├── gi/
│   ├── db-ui/
│   │   └── src/
│   │       └── gdrive/
│   │           ├── GenshinSlotAdapter.ts     # Refactored: Storage proxy subscription & blacklist
│   │           └── GenshinSlotAdapter.test.ts # Storage event trigger & blacklist tests
│   │
│   └── ui/
│       └── src/
│           └── components/
│               └── database/
│                   ├── DatabaseCard.tsx      # Reverted: Remove ad-hoc lastEdit timestamp sets
│                   └── UploadCard.tsx        # Reverted: Remove ad-hoc lastEdit timestamp sets
```

**Structure Decision**:
- Storage write interception is provided by `@genshin-optimizer/common/database` (`LocalStorageProxy`).
- Storage event observation and blacklist filtering are placed directly in `GenshinSlotAdapter.ts` within `libs/gi/db-ui/src/gdrive/` (or dedicated sub-module), cleanly fulfilling the `subscribeToChanges` interface.
- Manual timestamp mutations in `DatabaseCard.tsx` and `UploadCard.tsx` are removed to restore architectural parity with `origin/customize`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| :--- | :--- | :--- |
| *None* | No constitutional violations. Design simplifies existing architecture by eliminating complex database manager listener loops and UI hacks. | N/A |
