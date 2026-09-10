# Contract: Slot Adapter Storage Change Detection

**Module**: `@genshin-optimizer/gi/db-ui`  
**Class**: `GenshinSlotAdapter`  
**Target File**: `libs/gi/db-ui/src/gdrive/GenshinSlotAdapter.ts`

---

## 1. Interface Definition

`GenshinSlotAdapter` implements `MultiSlotDataAdapter<unknown>`.

```typescript
export interface MultiSlotDataAdapter<SlotData = unknown> {
  readonly appId: string
  exportAllSlots(): Promise<{
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<SlotData>>
    contentHash: string
  }>
  importAllSlots(packageData: UnifiedSyncPackage<SlotData>): Promise<void>
  subscribeToChanges(listener: (reason?: string) => void): () => void
  getSlotSummaries(
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<SlotData>>
  ): Record<1 | 2 | 3 | 4, SlotSummary>
  isLocalEmpty(): boolean
}
```

---

## 2. Contract Specification: `subscribeToChanges`

### Method Signature
```typescript
public subscribeToChanges(listener: (reason?: string) => void): () => void
```

### Preconditions
- Persistent storage proxy (`LocalStorageProxy`) is installed in the runtime environment (or storage operations occur via proxied storage).
- `listener` is a non-null function accepting an optional `reason` string parameter.

### Behavioral Guarantees
1. **Subscription Lifecycle**:
   - The first active subscriber connects to `addGlobalStorageWriteListener` from `@genshin-optimizer/common/database`.
   - Subsequent subscribers share the same underlying storage write subscription.
   - Calling the returned unsubscription function removes the subscriber.
   - When the subscriber count drops to zero, the underlying storage listener is detached and cleaned up.

2. **Operation Filtering**:
   - For `event.type === 'clear'`:
     - Dispatches `listener('storage:clear')`.
   - For `event.type === 'setItem'` or `event.type === 'removeItem'`:
     - If `event.key` is defined and `isKeyBlacklisted(event.key)` is `true`:
       - Silently ignores the write. No subscribers are called.
     - If `event.key` is defined and `isKeyBlacklisted(event.key)` is `false`:
       - Dispatches `listener('storage:' + event.type + ':' + event.key)`.

3. **Database Decoupling**:
   - `subscribeToChanges` MUST NOT register listeners on `db.dataManagers` (`chars`, `arts`, `weapons`, etc.) or `db.dataEntries` (`dbMeta`).
   - Slot swaps and upload replacements are detected via the storage proxy write stream when records are serialized to storage.

---

## 3. Error Handling
- Exceptions thrown within user-provided listeners are caught and logged to console (`console.error`), preventing uncaught errors from disrupting application storage operations.
