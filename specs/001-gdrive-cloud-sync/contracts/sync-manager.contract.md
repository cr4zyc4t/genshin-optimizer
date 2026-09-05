# Contract: Cloud Sync Manager & Debounce Controller

**Feature**: Google Drive Cloud Synchronization  
**Module**: `@genshin-optimizer/common/gdrive`  
**Spec**: [spec.md](../spec.md)

This contract defines the coordination engine responsible for automatic sync triggers, debouncing via `lodash/debounce`, conflict detection, and slot adapter coordination.

---

## 1. MultiSlotDataAdapter Interface

Defines the pluggable contract that any frontend (Genshin, Star Rail, ZZZ) provides to export and import all database slots.

```typescript
export interface MultiSlotDataAdapter<SlotData = unknown> {
  /** Identifier of the frontend app (e.g., 'genshin-optimizer') */
  readonly appId: string

  /**
   * Serializes all 4 slots and their metadata into a single export structure.
   */
  exportAllSlots(): Promise<{
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<SlotData>>
    contentHash: string
  }>

  /**
   * Overwrites local storage for all 4 slots with the downloaded cloud payload.
   */
  importAllSlots(
    packageData: UnifiedSyncPackage<SlotData>
  ): Promise<void>

  /**
   * Subscribes to database change events across any slot.
   * Returns an unsubscribe function.
   */
  subscribeToChanges(listener: () => void): () => void

  /**
   * Calculates descriptive summary metrics (item counts, sizes) for conflict display.
   */
  getSlotSummaries(
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<SlotData>>
  ): Record<1 | 2 | 3 | 4, SlotSummary>
}
```

---

## 2. ICloudSyncManager Interface

```typescript
export interface ICloudSyncManager {
  /**
   * Registers the game-specific slot adapter.
   */
  setAdapter(adapter: MultiSlotDataAdapter): void

  /**
   * Starts event listeners (window focus, database mutation subscriber, debouncer).
   */
  start(): void

  /**
   * Tears down event listeners, cancels pending timers, and flushes any clean state.
   */
  stop(): void

  /**
   * Invoked on local database mutation.
   * Resets the 10-second debounce timer via lodash.debounce.
   */
  notifyDataChanged(): void

  /**
   * Invoked on window/tab focus for the first time in a session.
   * Checks remote state against local state.
   */
  handleWindowFocus(): Promise<void>

  /**
   * Bypasses the 10-second debounce and forces an immediate cloud upload.
   * Used when user resolves a conflict by picking "Keep Local Data".
   */
  forceUpload(): Promise<void>

  /**
   * Overwrites local data with remote data and clears conflict state.
   * Used when user resolves a conflict by picking "Use Cloud Data".
   */
  resolveWithCloud(): Promise<void>

  /**
   * Subscribes to runtime sync state updates (status, lastSyncTime, error).
   */
  subscribeState(
    listener: (state: SyncRuntimeMetadata) => void
  ): () => void

  /**
   * Subscribes to conflict events that require user resolution modal.
   */
  subscribeConflict(
    listener: (conflict: ConflictComparison | null) => void
  ): () => void
}
```
