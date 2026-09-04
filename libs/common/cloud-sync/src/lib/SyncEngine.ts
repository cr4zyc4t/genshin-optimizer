import {
  clampDebounceMs,
  MAX_UPLOAD_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './constants'
import { Debouncer } from './debounce'
import type { DriveClient } from './DriveClient'
import type {
  CloudSyncMeta,
  ConflictInfo,
  SyncResult,
  SyncStatus,
} from './types'

export interface SyncEngineDeps {
  driveClient: DriveClient
  /** Name of the Drive file for this slot, e.g. `gi-slot-1.json`. Used only the first time
   * (before `remoteFileId` is known) to find/create the slot's lazily-created file. */
  fileName: string
  /** Reads the current persisted `CloudSyncMeta` for this slot. */
  getMeta: () => CloudSyncMeta
  /** Persists a partial update to this slot's `CloudSyncMeta`. */
  setMeta: (meta: Partial<CloudSyncMeta>) => void
  /** Reads the current local `dbMeta.lastEdit` timestamp for this slot. */
  getLocalEdit: () => number
  /** Serializes the current local database (e.g. `JSON.stringify(database.exportGOOD())`). */
  getPayload: () => string
  /** Applies a downloaded snapshot to the local database (full replace). */
  applySnapshot: (json: string) => void
  /** Current debounce interval in ms (already clamped by the caller/UI, re-clamped here too). */
  getDebounceMs: () => number
}

export type SyncEngineListener = (
  status: SyncStatus,
  meta: CloudSyncMeta
) => void

function payloadSize(payload: string): number {
  return new TextEncoder().encode(payload).length
}

/**
 * Per-slot sync orchestration: debounced auto-upload (design doc §8) and startup/manual
 * download + conflict detection (design doc §9). Only ever instantiated for the currently
 * *active* slot (design doc §16.2) — callers are responsible for disposing the engine for a
 * slot that becomes inactive.
 */
export class SyncEngine {
  private readonly deps: SyncEngineDeps
  private readonly debouncer = new Debouncer()
  private status: SyncStatus = 'idle'
  private readonly listeners = new Set<SyncEngineListener>()
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  /** Cached remote metadata from the most recent `syncNow()`/conflict check, used by resolveConflict/getConflictInfo. */
  private pendingConflict:
    | {
        remoteFileId: string
        remoteModifiedTime: string
        remoteSize?: number | undefined
      }
    | undefined
  /** Bound `online` event handler, stored so it can be removed in `dispose()`. */
  private readonly onOnline: () => void

  constructor(deps: SyncEngineDeps) {
    this.deps = deps
    // M3 (design doc §12): when the browser comes back online, reset the retry counter and
    // immediately retry if the last attempt failed (status === 'error'). This handles the
    // case where MAX_UPLOAD_RETRIES was exhausted while offline — without this listener the
    // engine would sit in 'error' indefinitely until the user manually triggers a sync.
    this.onOnline = () => {
      if (this.status === 'error') {
        this.retryCount = 0
        this.upload().catch(() => {
          // error surfaced via status; scheduleRetry() will handle further retries
        })
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline)
    }
  }

  getStatus(): SyncStatus {
    return this.status
  }

  /** Local vs. cloud metadata for the currently-pending conflict, for the conflict dialog (design doc §10). */
  getConflictInfo(): ConflictInfo | undefined {
    if (!this.pendingConflict) return undefined
    return {
      local: {
        modifiedTime: this.deps.getLocalEdit(),
        size: payloadSize(this.deps.getPayload()),
      },
      cloud: {
        modifiedTime: new Date(
          this.pendingConflict.remoteModifiedTime
        ).getTime(),
        size: this.pendingConflict.remoteSize,
      },
    }
  }

  onStatusChange(listener: SyncEngineListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setStatus(status: SyncStatus) {
    this.status = status
    const meta = this.deps.getMeta()
    this.listeners.forEach((listener) => listener(status, meta))
  }

  dispose(): void {
    this.debouncer.cancel()
    if (this.retryTimer !== undefined) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
    this.listeners.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline)
    }
  }

  /** Call whenever `dbMeta.lastEdit` changes for this slot — (re)starts the upload debounce. */
  notifyLocalEdit(): void {
    if (!this.deps.getMeta().enabled) return
    this.setStatus('dirty')
    const delayMs = clampDebounceMs(this.deps.getDebounceMs())
    this.debouncer.schedule(() => {
      this.upload().catch(() => {
        // errors are surfaced via status + retried in scheduleRetry()
      })
    }, delayMs)
  }

  /** Best-effort immediate flush of a pending debounced upload — call before switching slots. */
  flushPendingUpload(): void {
    this.debouncer.flush()
  }
  // TODO (M4, design doc §8): add a `visibilitychange`/`beforeunload` listener that calls
  // flushPendingUpload() so pending changes are uploaded when the tab is closed or hidden.
  // Drive's API doesn't support sendBeacon semantics so this is best-effort only — do NOT
  // block the beforeunload event. Deferred to Phase 2.

  private async resolveRemoteFileId(): Promise<string | undefined> {
    const meta = this.deps.getMeta()
    if (meta.remoteFileId) return meta.remoteFileId
    const found = await this.deps.driveClient.findFileIdByName(
      this.deps.fileName
    )
    if (found) this.deps.setMeta({ remoteFileId: found })
    return found
  }

  /**
   * Uploads local data, refusing to overwrite if the remote changed since our last sync.
   *
   * @param knownRemoteMeta - Already-fetched remote file metadata, if the caller (e.g.
   *   `syncNow`) already has it. Skips the redundant `getFileMetadata` call in that case.
   */
  private async upload(
    knownRemoteMeta?: Awaited<ReturnType<DriveClient['getFileMetadata']>>
  ): Promise<void> {
    if (!this.deps.getMeta().enabled) return
    this.setStatus('syncing')
    try {
      const remoteFileId = await this.resolveRemoteFileId()
      const payload = this.deps.getPayload()
      const localEdit = this.deps.getLocalEdit()

      if (!remoteFileId) {
        const created = await this.deps.driveClient.createFile(
          this.deps.fileName,
          payload
        )
        this.deps.setMeta({
          remoteFileId: created.fileId,
          lastSyncedLocalEdit: localEdit,
          lastSyncedRemoteModifiedTime: created.modifiedTime,
          lastSyncedSize: created.size ?? payloadSize(payload),
        })
        this.retryCount = 0
        this.setStatus('synced')
        return
      }

      // Use the already-fetched metadata when available to avoid a redundant Drive API call.
      const remoteMeta =
        knownRemoteMeta !== undefined
          ? knownRemoteMeta
          : await this.deps.driveClient.getFileMetadata(remoteFileId)
      const meta = this.deps.getMeta()
      if (
        remoteMeta &&
        remoteMeta.modifiedTime !== meta.lastSyncedRemoteModifiedTime
      ) {
        // Remote changed since our last sync — do NOT blindly overwrite (design doc §8).
        this.pendingConflict = {
          remoteFileId,
          remoteModifiedTime: remoteMeta.modifiedTime,
          remoteSize: remoteMeta.size,
        }
        this.setStatus('conflict')
        return
      }

      const updated = await this.deps.driveClient.updateFile(
        remoteFileId,
        payload
      )
      this.deps.setMeta({
        lastSyncedLocalEdit: localEdit,
        lastSyncedRemoteModifiedTime: updated.modifiedTime,
        lastSyncedSize: updated.size ?? payloadSize(payload),
      })
      this.retryCount = 0
      this.setStatus('synced')
    } catch (e) {
      this.setStatus('error')
      this.scheduleRetry()
      throw e
    }
  }

  private scheduleRetry(): void {
    if (this.retryCount >= MAX_UPLOAD_RETRIES) return
    const delay = RETRY_BASE_DELAY_MS * 2 ** this.retryCount
    this.retryCount++
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => {
      this.upload().catch(() => {
        // further retries handled recursively by scheduleRetry
      })
    }, delay)
  }

  /**
   * Startup / manual "Sync now" flow (design doc §9): compares local vs. remote change
   * state since the last successful sync and fast-forwards in the unambiguous cases, or
   * surfaces a conflict for the caller to resolve via {@link resolveConflict}.
   */
  async syncNow(): Promise<SyncResult> {
    const meta = this.deps.getMeta()
    if (!meta.enabled) {
      this.setStatus('disabled')
      return 'noop'
    }
    this.setStatus('syncing')
    const remoteFileId = await this.resolveRemoteFileId()
    const localEdit = this.deps.getLocalEdit()
    const localChanged = localEdit !== meta.lastSyncedLocalEdit

    if (!remoteFileId) {
      // Never synced before — nothing to compare against, just upload to create the file.
      await this.upload()
      return 'uploaded'
    }

    const remoteMeta = await this.deps.driveClient.getFileMetadata(remoteFileId)
    const remoteChanged =
      !!remoteMeta &&
      remoteMeta.modifiedTime !== meta.lastSyncedRemoteModifiedTime

    if (!localChanged && !remoteChanged) {
      this.setStatus('synced')
      return 'noop'
    }
    if (localChanged && !remoteChanged) {
      // Pass already-fetched remoteMeta so upload() skips the redundant getFileMetadata call.
      await this.upload(remoteMeta)
      return 'uploaded'
    }
    if (!localChanged && remoteChanged && remoteMeta) {
      await this.downloadAndApply(
        remoteFileId,
        remoteMeta.modifiedTime,
        remoteMeta.size
      )
      return 'downloaded'
    }
    // Both changed independently — genuine conflict.
    this.pendingConflict = remoteMeta
      ? {
          remoteFileId,
          remoteModifiedTime: remoteMeta.modifiedTime,
          remoteSize: remoteMeta.size,
        }
      : undefined
    this.setStatus('conflict')
    return 'conflict'
  }

  private async downloadAndApply(
    remoteFileId: string,
    remoteModifiedTime: string,
    remoteSize: number | undefined
  ): Promise<void> {
    const json = await this.deps.driveClient.downloadFile(remoteFileId)
    this.deps.applySnapshot(json)
    this.deps.setMeta({
      remoteFileId,
      lastSyncedLocalEdit: this.deps.getLocalEdit(),
      lastSyncedRemoteModifiedTime: remoteModifiedTime,
      lastSyncedSize: remoteSize ?? payloadSize(json),
    })
    this.retryCount = 0
    this.pendingConflict = undefined
    this.setStatus('synced')
  }

  /** Resolves a conflict previously surfaced by `upload()` or `syncNow()` (design doc §10). */
  async resolveConflict(choice: 'keepLocal' | 'keepCloud'): Promise<void> {
    if (choice === 'keepCloud') {
      const conflict = this.pendingConflict
      if (!conflict) return
      await this.downloadAndApply(
        conflict.remoteFileId,
        conflict.remoteModifiedTime,
        conflict.remoteSize
      )
      return
    }
    // keepLocal: force-overwrite the remote file, bypassing the remote-changed guard.
    const remoteFileId = await this.resolveRemoteFileId()
    const payload = this.deps.getPayload()
    const localEdit = this.deps.getLocalEdit()
    this.setStatus('syncing')
    try {
      if (!remoteFileId) {
        const created = await this.deps.driveClient.createFile(
          this.deps.fileName,
          payload
        )
        this.deps.setMeta({
          remoteFileId: created.fileId,
          lastSyncedLocalEdit: localEdit,
          lastSyncedRemoteModifiedTime: created.modifiedTime,
          lastSyncedSize: created.size ?? payloadSize(payload),
        })
      } else {
        const updated = await this.deps.driveClient.updateFile(
          remoteFileId,
          payload
        )
        this.deps.setMeta({
          lastSyncedLocalEdit: localEdit,
          lastSyncedRemoteModifiedTime: updated.modifiedTime,
          lastSyncedSize: updated.size ?? payloadSize(payload),
        })
      }
      this.pendingConflict = undefined
      this.retryCount = 0
      this.setStatus('synced')
    } catch (e) {
      this.setStatus('error')
      this.scheduleRetry()
      throw e
    }
  }
}
