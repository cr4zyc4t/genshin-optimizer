# Research & Technical Decisions: Storage Proxy Synchronization Trigger

**Feature**: Storage Proxy Synchronization Trigger  
**Branch**: `002-storage-proxy-sync-trigger`  
**Date**: 2026-09-10

---

## 1. Storage Mutation Subscription Pattern

### Decision
Subscribe to persistent storage mutations in `GenshinSlotAdapter.subscribeToChanges` via `addGlobalStorageWriteListener` provided by `@genshin-optimizer/common/database`.

### Rationale
- `addGlobalStorageWriteListener` registers listeners on the centralized storage event bus managed by `LocalStorageProxy`.
- Returns a cleanup function `() => void` that integrates cleanly into the existing `subscribeToChanges` contract.
- Operates safely across execution environments: in testing environments where `installLocalStorageProxy()` is invoked on a mock or JSDOM storage, listeners fire consistently.
- Decouples `CloudSyncManager` completely from storage APIs—the sync manager continues to interact with the standard `MultiSlotDataAdapter.subscribeToChanges` interface.

### Alternatives Considered
- **Direct window.localStorage subscription via property cast**:
  - `(window.localStorage as ProxiedStorage).addWriteListener(listener)`
  - Rejected because `window.localStorage` might not be installed yet or might throw in non-browser unit test environments without null-checks.
- **Native DOM 'storage' event listener**:
  - `window.addEventListener('storage', ...)`
  - Rejected because the native DOM `storage` event only fires in *other* windows/tabs, not within the window that made the write! `LocalStorageProxy` intercepts in-memory writes directly within the active window.
- **Direct binding in CloudSyncManager**:
  - Rejected during clarification phase (Option A selected) to keep `CloudSyncManager` game- and platform-agnostic.

---

## 2. Key Blacklist Structure and Evaluation Strategy

### Decision
Implement a hybrid exclusion filter consisting of a `Set<string>` of exact literal keys and an array `string[]` of namespace prefix patterns:

```typescript
export interface StorageKeyBlacklist {
  readonly exactKeys: ReadonlySet<string>
  readonly prefixPatterns: readonly string[]
}

export const DEFAULT_STORAGE_BLACKLIST: StorageKeyBlacklist = {
  exactKeys: new Set(['snow', 'silly', 'newTabKey']),
  prefixPatterns: ['gdrive_', 'infoShown_'],
}

export function isKeyBlacklisted(
  key: string,
  blacklist: StorageKeyBlacklist = DEFAULT_STORAGE_BLACKLIST
): boolean {
  if (blacklist.exactKeys.has(key)) return true
  for (const prefix of blacklist.prefixPatterns) {
    if (key.startsWith(prefix)) return true
  }
  return false
}
```

### Rationale
- **Performance**: O(1) exact key lookup via `Set.has()`, followed by a fast iteration over a small array of prefix strings using native `String.prototype.startsWith()`. Total evaluation time is well under 1 microsecond per storage write.
- **Dynamic Key Coverage**: Prefix patterns like `'gdrive_'` automatically capture all current and future sync keys (`gdrive_sync_metadata`, `gdrive_auth_session`, `gdrive_auth_state`, `gdrive_temp_*`) without requiring manual enumeration.
- **UI Decoupling**: Prevents transient settings like UI easter eggs (`snow`, `silly`) and tutorial acknowledgments (`infoShown_*`) from triggering unneeded network syncs.

### Alternatives Considered
- **Regular Expressions (`RegExp[]`)**:
  - Evaluated against each key.
  - Rejected because regex creation and testing is slower and more prone to catastrophic backtracking or syntax bugs than simple prefix checks.
- **Whitelist (inclusion list) of database keys**:
  - Matching only known database keys (e.g., `db_ver`, `dbIndex`, `artifact_*`, `char_*`, etc.).
  - Rejected because slot naming in Genshin Optimizer can include dynamic slot prefix structures (`extraDatabase_*`, custom slot prefixes) and any newly added domain table would risk not syncing if omitted from the whitelist. A blacklist is safer for data preservation.

---

## 3. Handling Storage `clear` Operations

### Decision
Whenever `LocalStorageProxy` emits a write event with `type === 'clear'`, `GenshinSlotAdapter` will unconditionally emit a change notification to its subscribers (`CloudSyncManager`).

### Rationale
- `localStorage.clear()` wipes all data keys across all database slots.
- Because `event.key` is undefined for `clear`, key-level blacklisting does not apply.
- Treating `clear` as a change notification allows `CloudSyncManager` to detect that the local database has been reset and trigger the appropriate synchronization or conflict flow (e.g. evaluating empty state against remote data).

### Alternatives Considered
- **Ignoring `clear` events**:
  - Rejected because users clearing database state via browser settings or in-app reset would leave remote cloud data out of sync.

---

## 4. Reversion of Database-Layer and UI Card Hacks

### Decision
Completely revert the ad-hoc modifications introduced in commit `d8a712a0f` and `99cfba040` back to the pristine `origin/customize` baseline:

1. **`libs/gi/ui/src/components/database/DatabaseCard.tsx`**:
   - Remove lines:
     ```typescript
     mainDB.dbMeta.set({ lastEdit: Date.now() })
     database.dbMeta.set({ lastEdit: Date.now() })
     ```
   - When a slot is swapped via `onSwap`, `mainDB.toExtraLocalDB()` and `database.swapStorage(mainDB)` write directly to `localStorage`, which is immediately intercepted by `LocalStorageProxy`.
2. **`libs/gi/ui/src/components/database/UploadCard.tsx`**:
   - Remove line:
     ```typescript
     importedDatabase.dbMeta.set({ lastEdit: Date.now() })
     ```
   - When an imported database is applied via `replaceDB`, `importedDatabase.swapStorage(database)` and `importedDatabase.toExtraLocalDB()` write to `localStorage`, immediately intercepted by `LocalStorageProxy`.
3. **`libs/gi/db-ui/src/gdrive/GenshinSlotAdapter.ts`**:
   - Remove `bindDbListeners()` loop over `db.dataManagers` and `db.dataEntries`.
   - Remove `dbUnsubscribes`.
   - Replace with `addGlobalStorageWriteListener` with blacklist filtering.
4. **`libs/gi/db/src/Database/ArtCharDatabase.ts`**:
   - Ensure clean database event subscriptions matching `origin/customize`.

### Rationale
- Restores architectural purity: UI cards should solely manage component state and presentation, not trigger side-effect mutations or spoof timestamps for synchronization purposes.
- Eliminates brittle coupling between data manager internals and external sync triggers.
