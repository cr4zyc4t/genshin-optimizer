import type { SlotSummary, UnifiedSlotEntry, UnifiedSyncPackage } from './types'

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
  importAllSlots(packageData: UnifiedSyncPackage<SlotData>): Promise<void>

  /**
   * Subscribes to database change events across any slot.
   * Returns an unsubscribe function.
   */
  subscribeToChanges(listener: (reason?: string) => void): () => void

  /**
   * Calculates descriptive summary metrics (item counts, sizes) for conflict display.
   */
  getSlotSummaries(
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<SlotData>>
  ): Record<1 | 2 | 3 | 4, SlotSummary>

  /**
   * Checks whether all local slots are uninitialized / empty.
   */
  isLocalEmpty(): boolean
}
