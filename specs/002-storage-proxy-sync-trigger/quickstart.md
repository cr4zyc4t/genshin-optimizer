# Quickstart & Verification Guide: Storage Proxy Synchronization Trigger

**Feature**: Storage Proxy Synchronization Trigger  
**Branch**: `002-storage-proxy-sync-trigger`  
**Date**: 2026-09-10

---

## 1. Overview & Prerequisites

This guide provides runnable instructions to verify that persistent storage mutation events (`setItem`, `removeItem`, `clear`) trigger cloud synchronization, that the key blacklist suppresses recursive sync loops and transient settings, and that the UI cards and database layers are reverted to the clean baseline.

### Prerequisites
- Node.js pinned in `.nvmrc`
- Dependencies installed via `yarn install --immutable`
- Workspace verified via Nx

---

## 2. Automated Test Execution

Run Vitest unit tests for the affected libraries to verify storage proxy change detection and blacklist filtering:

```bash
# 1. Run Genshin slot adapter unit tests
npx nx test gi-db-ui

# 2. Run LocalStorageProxy tests in common database
npx nx test common-database

# 3. Run CloudSyncManager unit tests
npx nx test common-gdrive
```

**Expected Results**:
- All tests pass with 0 failures.
- `GenshinSlotAdapter.test.ts` validates:
  - Non-blacklisted `setItem` dispatches change notifications.
  - `clear()` dispatches change notifications.
  - Blacklisted keys (`gdrive_*`, `snow`, `silly`, `infoShown_*`) dispatch 0 notifications.
  - Unsubscribing cleans up listeners.

---

## 3. Manual Verification Scenarios (Browser Environment)

### Scenario A: Verify Normal Database Mutation Triggers Sync Countdown
1. Start the Genshin development server:
   ```bash
   npx nx serve frontend
   ```
2. Open the application in your browser (`http://localhost:4200`) and open Browser DevTools Console.
3. In the Settings tab, connect Google Drive Cloud Sync (or observe sync status).
4. Edit any character, equip/unequip an artifact, or change a weapon.
5. **Expected Outcome**:
   - DevTools console displays `[LocalStorageProxy] setItem "..."` or storage write log.
   - Cloud Sync Status Chip transitions from `Synced` (or `Idle`) to `Saving...` (`DEBOUNCING`).
   - After the 5-second debounce expires without further edits, the status chip shows `Syncing...` followed by `Synced` with updated timestamp.

---

### Scenario B: Verify Database Slot Swap Triggers Sync
1. Navigate to Settings > Database management.
2. Swap the current database slot with another slot.
3. **Expected Outcome**:
   - The slot swap writes database structures to storage.
   - The sync manager detects the change and enters `DEBOUNCING` (`Saving...`).
   - Sync completes without requiring manual `dbMeta.set({ lastEdit: Date.now() })` in `DatabaseCard.tsx`.

---

### Scenario C: Verify Blacklisted Keys Do NOT Trigger Sync
1. With cloud sync connected and status at `Synced`, open browser DevTools Console.
2. Execute:
   ```javascript
   localStorage.setItem('snow', 'on')
   localStorage.setItem('infoShown_characters', 'true')
   localStorage.setItem('gdrive_test', '123')
   ```
3. **Expected Outcome**:
   - The storage writes succeed.
   - Cloud Sync status remains strictly `Synced` (does NOT enter `DEBOUNCING` or `Saving...`).
   - No network upload calls are initiated.

---

### Scenario D: Verify Baseline Reversion
1. Check git diff for UI components:
   ```bash
   git diff HEAD -- libs/gi/ui/src/components/database/DatabaseCard.tsx \
                    libs/gi/ui/src/components/database/UploadCard.tsx \
                    libs/gi/db/src/Database/ArtCharDatabase.ts
   ```
2. **Expected Outcome**:
   - Zero lines modifying `lastEdit` manually inside `DatabaseCard.tsx` or `UploadCard.tsx`.
   - Clean implementation aligning with `origin/customize`.

---

## 4. Full Quality Gate Verification

Before finalizing work:
```bash
yarn run mini-ci
```
**Expected Outcome**:
- Biome format and lint check pass with 0 errors.
- TypeScript typecheck passes across all affected libraries.
- All unit test suites pass.
