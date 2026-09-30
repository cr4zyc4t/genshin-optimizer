import {
  addGlobalStorageWriteListener,
  type StorageWriteEvent,
  type StorageWriteListener,
} from '@genshin-optimizer/common/database'
import type {
  MultiSlotDataAdapter,
  SlotSummary,
  UnifiedSlotEntry,
  UnifiedSyncPackage,
} from '@genshin-optimizer/common/gdrive'
import type { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import {
  DEFAULT_STORAGE_BLACKLIST,
  isKeyBlacklisted,
  type StorageKeyBlacklist,
} from './blacklist'

export interface GenshinSlotAdapterOptions {
  blacklist?: StorageKeyBlacklist
  subscribeStorage?: (listener: StorageWriteListener) => () => void
}

export class GenshinSlotAdapter implements MultiSlotDataAdapter<unknown> {
  readonly appId = 'genshin-optimizer'
  private databases: ArtCharDatabase[]
  private activeListeners = new Set<(reason?: string) => void>()
  private storageUnsubscribe: (() => void) | null = null
  private blacklist: StorageKeyBlacklist
  private subscribeStorageFn: (listener: StorageWriteListener) => () => void

  constructor(
    databases: ArtCharDatabase[],
    options: GenshinSlotAdapterOptions = {}
  ) {
    this.databases = databases
    this.blacklist = options.blacklist ?? DEFAULT_STORAGE_BLACKLIST
    this.subscribeStorageFn =
      options.subscribeStorage ?? addGlobalStorageWriteListener
  }

  public updateDatabases(databases: ArtCharDatabase[]) {
    this.databases = databases
  }

  public async exportAllSlots(): Promise<{
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>
    contentHash: string
  }> {
    const slots = {} as Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>
    for (let i = 0; i < 4; i++) {
      const slotNum = (i + 1) as 1 | 2 | 3 | 4
      const db = this.databases[i]
      const meta = db?.dbMeta?.get()
      const data = db ? db.exportGOOD() : null
      slots[slotNum] = {
        name: meta?.name ?? `Database ${slotNum}`,
        lastEdit: meta?.lastEdit ?? 0,
        data,
      }
    }

    const str = JSON.stringify(slots)
    const contentHash = await computeSHA256(str)

    return {
      slots,
      contentHash,
    }
  }

  public async importAllSlots(
    packageData: UnifiedSyncPackage<unknown>
  ): Promise<void> {
    for (let i = 0; i < 4; i++) {
      const slotNum = (i + 1) as 1 | 2 | 3 | 4
      const slot = packageData.slots[slotNum]
      const db = this.databases[i]
      if (db && slot?.data) {
        db.clear()
        db.importGOOD(slot.data as any, false, false, false)
        if (slot.name) {
          db.dbMeta.set({ name: slot.name })
        }
        db.toExtraLocalDB()
      }
    }
  }

  public subscribeToChanges(listener: (reason?: string) => void): () => void {
    this.activeListeners.add(listener)

    if (this.activeListeners.size === 1) {
      this.storageUnsubscribe = this.subscribeStorageFn(
        (event: StorageWriteEvent) => {
          if (event.type === 'clear') {
            this.notify('storage:clear')
            return
          }

          if (event.key && !isKeyBlacklisted(event.key, this.blacklist)) {
            this.notify(`storage:${event.type}:${event.key}`)
          }
        }
      )
    }

    return () => {
      this.activeListeners.delete(listener)
      if (this.activeListeners.size === 0) {
        this.storageUnsubscribe?.()
        this.storageUnsubscribe = null
      }
    }
  }

  private notify(reason?: string): void {
    for (const listener of this.activeListeners) {
      try {
        listener(reason)
      } catch (err) {
        console.error('[GenshinSlotAdapter] Error in change listener:', err)
      }
    }
  }

  public getSlotSummaries(
    slots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>
  ): Record<1 | 2 | 3 | 4, SlotSummary> {
    const summaries = {} as Record<1 | 2 | 3 | 4, SlotSummary>
    for (const slotNum of [1, 2, 3, 4] as const) {
      const slot = slots[slotNum]
      const data = (slot?.data ?? {}) as {
        characters?: unknown[]
        artifacts?: unknown[]
        weapons?: unknown[]
      }
      const charCount = Array.isArray(data.characters)
        ? data.characters.length
        : 0
      const artCount = Array.isArray(data.artifacts) ? data.artifacts.length : 0
      const wepCount = Array.isArray(data.weapons) ? data.weapons.length : 0

      summaries[slotNum] = {
        name: slot?.name ?? `Database ${slotNum}`,
        lastEdit: slot?.lastEdit ?? 0,
        characterCount: charCount,
        artifactCount: artCount,
        weaponCount: wepCount,
      }
    }
    return summaries
  }

  public isLocalEmpty(): boolean {
    for (const db of this.databases) {
      if (!db) continue
      const charCount = db.chars?.keys?.length ?? 0
      const artCount = db.arts?.keys?.length ?? 0
      const wepCount = db.weapons?.keys?.length ?? 0
      if (charCount > 0 || artCount > 0 || wepCount > 0) {
        return false
      }
    }
    return true
  }
}

/**
 * Computes a SHA-256 hex digest of the given string using the SubtleCrypto API.
 * Falls back to a simple FNV-1a hash only when SubtleCrypto is unavailable
 * (e.g., non-secure test contexts).
 */
async function computeSHA256(str: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return (
      'sha256-' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    )
  }

  // Fallback: FNV-1a 32-bit (test/SSR environments without SubtleCrypto)
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return `fnv-${hash.toString(16)}`
}
