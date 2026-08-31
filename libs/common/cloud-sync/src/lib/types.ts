/** Per-slot cloud sync metadata, persisted alongside a game's `dbMeta` (design doc §7). */
export interface CloudSyncMeta {
  /** User opted this slot into sync. */
  enabled: boolean
  /** Drive file id in `appDataFolder`, once created. */
  remoteFileId?: string
  /** Value of `dbMeta.lastEdit` at the moment of the last successful sync. */
  lastSyncedLocalEdit?: number
  /** Drive `modifiedTime` (RFC3339) at the moment of the last successful sync. */
  lastSyncedRemoteModifiedTime?: string
  /** Byte size of the payload at last sync (for quick conflict-dialog display). */
  lastSyncedSize?: number
}

/** Global (not per-slot) cloud sync settings, one per game (design doc §7). */
export interface CloudSyncSettings {
  /** Display-only Google account info, populated once signed in. */
  account?: { email: string; avatarUrl?: string }
  /** User-configurable auto-upload debounce interval, clamped to [DEBOUNCE_MIN_MS, DEBOUNCE_MAX_MS]. */
  debounceMs: number
}

/** Status of a single slot's {@link SyncEngine}. */
export type SyncStatus =
  | 'signed-out'
  | 'disabled'
  | 'idle'
  | 'dirty'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error'

/** Metadata describing one side (local or cloud) of a detected conflict, for the conflict dialog. */
export interface ConflictSide {
  modifiedTime: number
  size?: number | undefined
}

export interface ConflictInfo {
  local: ConflictSide
  cloud: ConflictSide
}

export type SyncResult = 'uploaded' | 'downloaded' | 'conflict' | 'noop'
