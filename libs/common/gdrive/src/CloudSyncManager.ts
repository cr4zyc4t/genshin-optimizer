import debounce from 'lodash.debounce'
import type { MultiSlotDataAdapter } from './adapter'
import type { GoogleDriveApiClient } from './GoogleDriveApiClient'
import type { GoogleIdentityClient } from './GoogleIdentityClient'
import type {
  ConflictComparison,
  DriveFileMetadata,
  SyncRuntimeMetadata,
  UnifiedSlotEntry,
  UnifiedSyncPackage,
} from './types'

export const SYNC_METADATA_STORAGE_KEY = 'gdrive_sync_metadata'

export interface CloudSyncManagerOptions {
  debounceMs?: number | undefined
  syncFileName?: string | undefined
}

export class CloudSyncManager {
  private identityClient: GoogleIdentityClient
  private driveClient: GoogleDriveApiClient
  private adapter: MultiSlotDataAdapter | null = null

  private debounceMs: number
  private syncFileName: string
  private debouncedSyncFn: (() => void) & {
    cancel: () => void
    flush: () => void
  }

  private state: SyncRuntimeMetadata
  private activeConflict: ConflictComparison | null = null
  private stateListeners = new Set<(state: SyncRuntimeMetadata) => void>()
  private conflictListeners = new Set<
    (conflict: ConflictComparison | null) => void
  >()

  private unsubscribeDbChanges: (() => void) | null = null
  private focusHandler: (() => void) | null = null
  private isApplyingRemote = false

  constructor(
    identityClient: GoogleIdentityClient,
    driveClient: GoogleDriveApiClient,
    options: CloudSyncManagerOptions = {}
  ) {
    this.identityClient = identityClient
    this.driveClient = driveClient
    this.debounceMs = options.debounceMs ?? 10000
    this.syncFileName = options.syncFileName ?? 'genshin_optimizer_sync.json'

    this.state = this.loadCachedMetadata() ?? {
      status: 'UNAUTHENTICATED',
      lastSyncTime: null,
      remoteFileId: null,
      remoteModifiedTime: null,
      lastRemoteHash: null,
      isLocalDirty: false,
      errorMessage: null,
    }

    this.debouncedSyncFn = debounce(() => {
      console.log(
        '[CloudSync] Trigger: 10s debounce timer expired -> starting sync()'
      )
      this.sync().catch((err) => {
        console.error('[CloudSync] Debounced sync failed:', err)
      })
    }, this.debounceMs)
  }

  public setAdapter(adapter: MultiSlotDataAdapter): void {
    const prevAdapter = this.adapter
    this.adapter = adapter
    this.syncFileName = `${adapter.appId}_sync.json`
    if (this.unsubscribeDbChanges && prevAdapter !== adapter) {
      console.log(
        '[CloudSync] Manager: re-subscribing database changes for new adapter'
      )
      this.unsubscribeDbChanges()
      this.unsubscribeDbChanges = this.adapter.subscribeToChanges((reason) => {
        this.notifyDataChanged(reason)
      })
    }
  }

  public getAdapter(): MultiSlotDataAdapter | null {
    return this.adapter
  }

  public getState(): SyncRuntimeMetadata {
    return { ...this.state }
  }

  public getActiveConflict(): ConflictComparison | null {
    return this.activeConflict
  }

  public subscribeState(
    listener: (state: SyncRuntimeMetadata) => void
  ): () => void {
    this.stateListeners.add(listener)
    listener(this.getState())
    return () => this.stateListeners.delete(listener)
  }

  public subscribeConflict(
    listener: (conflict: ConflictComparison | null) => void
  ): () => void {
    this.conflictListeners.add(listener)
    listener(this.activeConflict)
    return () => this.conflictListeners.delete(listener)
  }

  private updateState(partial: Partial<SyncRuntimeMetadata>): void {
    this.state = { ...this.state, ...partial }
    this.saveCachedMetadata(this.state)
    for (const listener of this.stateListeners) {
      try {
        listener(this.getState())
      } catch (e) {
        console.error('Error in sync state listener', e)
      }
    }
  }

  private updateConflict(conflict: ConflictComparison | null): void {
    this.activeConflict = conflict
    for (const listener of this.conflictListeners) {
      try {
        listener(this.activeConflict)
      } catch (e) {
        console.error('Error in conflict listener', e)
      }
    }
  }

  /**
   * Start lifecycle listeners (database mutations, window focus).
   */
  public start(): void {
    if (this.unsubscribeDbChanges) return
    console.log(
      '[CloudSync] Manager starting listeners (DB mutations & window focus)'
    )

    if (this.adapter) {
      this.unsubscribeDbChanges = this.adapter.subscribeToChanges((reason) => {
        this.notifyDataChanged(reason)
      })
    }

    if (typeof window !== 'undefined') {
      this.focusHandler = () => {
        console.log('[CloudSync] Window focus event detected')
        this.handleWindowFocus().catch(console.error)
      }
      window.addEventListener('focus', this.focusHandler)
    }
  }

  /**
   * Stop listeners and cancel pending timers.
   */
  public stop(): void {
    console.log(
      '[CloudSync] Manager stopping listeners and cancelling pending debounce timer'
    )
    if (this.unsubscribeDbChanges) {
      this.unsubscribeDbChanges()
      this.unsubscribeDbChanges = null
    }

    if (this.focusHandler && typeof window !== 'undefined') {
      window.removeEventListener('focus', this.focusHandler)
      this.focusHandler = null
    }

    this.debouncedSyncFn.cancel()
  }

  /**
   * Called when local database data changes. Starts/resets 10s debounce timer.
   */
  public notifyDataChanged(reason?: string): void {
    if (this.isApplyingRemote) {
      console.log(
        '[CloudSync] Local change detected during remote import -> ignoring'
      )
      return
    }

    const session = this.identityClient.loadCachedSession()
    if (!session) {
      console.log(
        '[CloudSync] Local change detected but unauthenticated -> ignoring'
      )
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    // If currently in unresolved conflict, do not trigger auto sync
    if (this.state.status === 'CONFLICT') {
      console.log(
        '[CloudSync] Local change detected but CONFLICT is active -> skipping auto-sync'
      )
      return
    }

    console.log(
      `[CloudSync] Trigger: local data changed${reason ? ` [${reason}]` : ''} -> setting DEBOUNCING (10s timer started/reset)`
    )
    this.updateState({ isLocalDirty: true, status: 'DEBOUNCING' })
    this.debouncedSyncFn()
  }

  /**
   * Triggered on initial window focus in session.
   */
  public async handleWindowFocus(): Promise<void> {
    const session = this.identityClient.loadCachedSession()
    if (!session) {
      console.log(
        '[CloudSync] Window focus check: unauthenticated -> skipping sync'
      )
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    if (this.state.status === 'CONFLICT') {
      console.log(
        '[CloudSync] Window focus check: CONFLICT unresolved -> skipping sync'
      )
      return
    }

    console.log('[CloudSync] Trigger: window focus check -> executing sync()')
    await this.sync()
  }

  /**
   * Core synchronization operation.
   */
  public async sync(): Promise<void> {
    if (!this.adapter) {
      console.log('[CloudSync] sync() aborted: no adapter set')
      return
    }

    let session = this.identityClient.loadCachedSession()
    if (!session) {
      console.log('[CloudSync] sync() aborted: no active session')
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    console.log('[CloudSync] sync() started', {
      user: session.email,
      isLocalDirty: this.state.isLocalDirty,
      status: this.state.status,
      lastSyncTime: this.state.lastSyncTime
        ? new Date(this.state.lastSyncTime).toLocaleTimeString()
        : 'Never',
    })

    if (this.identityClient.shouldRenewSession(session)) {
      console.log(
        '[CloudSync] Session token near expiry -> attempting silent refresh'
      )
      const renewed = await this.identityClient.silentRefresh()
      if (renewed) session = renewed
    }

    this.updateState({ status: 'SYNCING', errorMessage: null })

    try {
      const remoteFile = await this.driveClient.findFile(
        session.accessToken,
        this.syncFileName
      )

      // Case 1: Remote file does not exist in appDataFolder
      if (!remoteFile) {
        // If local is also empty, nothing to upload yet
        if (this.adapter.isLocalEmpty()) {
          console.log(
            '[CloudSync] sync() [Case 1]: Remote file not found & local is empty -> nothing to sync'
          )
          this.updateState({ status: 'IDLE', isLocalDirty: false })
          return
        }

        console.log(
          '[CloudSync] sync() [Case 1]: Remote file not found -> creating initial cloud backup'
        )
        const { slots, contentHash } = await this.adapter.exportAllSlots()
        const newPackage: UnifiedSyncPackage = {
          version: 1,
          appId: this.adapter.appId,
          createdAt: Date.now(),
          contentHash,
          slots,
        }

        const created = await this.driveClient.createFile(
          session.accessToken,
          this.syncFileName,
          newPackage
        )

        this.updateState({
          status: 'IDLE',
          lastSyncTime: Date.now(),
          remoteFileId: created.id,
          remoteModifiedTime: created.modifiedTime,
          lastRemoteHash: contentHash,
          isLocalDirty: false,
        })
        console.log(
          '[CloudSync] sync() [Case 1]: Initial cloud backup created successfully'
        )
        return
      }

      // Case 2: Remote file exists
      const isRemoteNewer =
        !this.state.remoteModifiedTime ||
        remoteFile.modifiedTime > this.state.remoteModifiedTime

      // If local is completely empty (fresh device/browser), auto-restore remote without conflict
      if (this.adapter.isLocalEmpty()) {
        console.log(
          '[CloudSync] sync() [Case 2]: Local is empty -> downloading and restoring cloud backup'
        )
        const remoteData =
          await this.driveClient.downloadFile<UnifiedSyncPackage>(
            session.accessToken,
            remoteFile.id
          )
        this.isApplyingRemote = true
        try {
          await this.adapter.importAllSlots(remoteData)
        } finally {
          this.isApplyingRemote = false
        }

        this.updateState({
          status: 'IDLE',
          lastSyncTime: Date.now(),
          remoteFileId: remoteFile.id,
          remoteModifiedTime: remoteFile.modifiedTime,
          lastRemoteHash: remoteData.contentHash,
          isLocalDirty: false,
        })
        console.log(
          '[CloudSync] sync() [Case 2]: Local data restored from cloud backup'
        )
        return
      }

      const { slots: localSlots, contentHash: localHash } =
        await this.adapter.exportAllSlots()

      // Case 3: Both local and remote have changes -> Potential Conflict
      if (this.state.isLocalDirty && isRemoteNewer) {
        console.log(
          '[CloudSync] sync() [Case 3]: Checking potential conflict (local dirty & remote modified)'
        )
        const remoteData =
          await this.driveClient.downloadFile<UnifiedSyncPackage>(
            session.accessToken,
            remoteFile.id
          )

        if (remoteData.contentHash !== localHash) {
          console.warn(
            '[CloudSync] sync() [Case 3]: CONFLICT DETECTED between local and cloud data!'
          )
          // Trigger conflict state
          const conflict = this.buildConflictComparison(
            localSlots,
            remoteData,
            remoteFile
          )
          this.updateConflict(conflict)
          this.updateState({ status: 'CONFLICT' })
          return
        }
      }

      // Case 4: Remote is newer and local is not dirty -> Download & update local
      if (isRemoteNewer && !this.state.isLocalDirty) {
        console.log(
          '[CloudSync] sync() [Case 4]: Remote is newer & local is clean -> downloading cloud backup'
        )
        const remoteData =
          await this.driveClient.downloadFile<UnifiedSyncPackage>(
            session.accessToken,
            remoteFile.id
          )
        this.isApplyingRemote = true
        try {
          await this.adapter.importAllSlots(remoteData)
        } finally {
          this.isApplyingRemote = false
        }

        this.updateState({
          status: 'IDLE',
          lastSyncTime: Date.now(),
          remoteFileId: remoteFile.id,
          remoteModifiedTime: remoteFile.modifiedTime,
          lastRemoteHash: remoteData.contentHash,
          isLocalDirty: false,
        })
        console.log(
          '[CloudSync] sync() [Case 4]: Local data updated from newer cloud backup'
        )
        return
      }

      // Case 5: Local is dirty and remote is not newer -> Upload local to Drive
      if (this.state.isLocalDirty) {
        console.log(
          '[CloudSync] sync() [Case 5]: Local is dirty -> uploading changes to cloud'
        )
        const updatePackage: UnifiedSyncPackage = {
          version: 1,
          appId: this.adapter.appId,
          createdAt: Date.now(),
          contentHash: localHash,
          slots: localSlots,
        }

        const updated = await this.driveClient.updateFile(
          session.accessToken,
          remoteFile.id,
          updatePackage
        )

        this.updateState({
          status: 'IDLE',
          lastSyncTime: Date.now(),
          remoteFileId: updated.id,
          remoteModifiedTime: updated.modifiedTime,
          lastRemoteHash: localHash,
          isLocalDirty: false,
        })
        console.log(
          '[CloudSync] sync() [Case 5]: Uploaded local changes to cloud successfully'
        )
        return
      }

      // Case 6: In sync
      console.log(
        '[CloudSync] sync() [Case 6]: Already in sync (no remote changes, local clean)'
      )
      this.updateState({ status: 'IDLE' })
    } catch (err: unknown) {
      console.error('[CloudSync] sync() error:', err)
      const msg = (err as Error)?.message ?? 'Sync failed'
      this.updateState({ status: 'ERROR', errorMessage: msg })
      throw err
    }
  }

  /**
   * Forces immediate upload of local data, bypassing debounce.
   * Used when user chooses "Keep Local Data" during conflict.
   */
  public async forceUpload(): Promise<void> {
    if (!this.adapter) return
    console.log(
      '[CloudSync] Trigger: forceUpload() called (overwriting cloud with local data)'
    )
    this.debouncedSyncFn.cancel()

    const session = this.identityClient.loadCachedSession()
    if (!session) {
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    this.updateState({ status: 'SYNCING', errorMessage: null })

    try {
      const { slots, contentHash } = await this.adapter.exportAllSlots()
      const packageData: UnifiedSyncPackage = {
        version: 1,
        appId: this.adapter.appId,
        createdAt: Date.now(),
        contentHash,
        slots,
      }

      const remoteFile = await this.driveClient.findFile(
        session.accessToken,
        this.syncFileName
      )

      let resultFile: DriveFileMetadata
      if (remoteFile) {
        resultFile = await this.driveClient.updateFile(
          session.accessToken,
          remoteFile.id,
          packageData
        )
      } else {
        resultFile = await this.driveClient.createFile(
          session.accessToken,
          this.syncFileName,
          packageData
        )
      }

      this.updateConflict(null)
      this.updateState({
        status: 'IDLE',
        lastSyncTime: Date.now(),
        remoteFileId: resultFile.id,
        remoteModifiedTime: resultFile.modifiedTime,
        lastRemoteHash: contentHash,
        isLocalDirty: false,
      })
      console.log('[CloudSync] forceUpload() finished successfully')
    } catch (err: unknown) {
      console.error('[CloudSync] forceUpload() failed:', err)
      const msg = (err as Error)?.message ?? 'Failed to upload local data'
      this.updateState({ status: 'ERROR', errorMessage: msg })
      throw err
    }
  }

  /**
   * Overwrites local slots with cloud data.
   * Used when user chooses "Use Cloud Data" during conflict.
   */
  public async resolveWithCloud(): Promise<void> {
    if (!this.adapter) return
    console.log(
      '[CloudSync] Trigger: resolveWithCloud() called (overwriting local with cloud data)'
    )
    this.debouncedSyncFn.cancel()

    const session = this.identityClient.loadCachedSession()
    if (!session) {
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    this.updateState({ status: 'SYNCING', errorMessage: null })

    try {
      const remoteFile = await this.driveClient.findFile(
        session.accessToken,
        this.syncFileName
      )
      if (!remoteFile) {
        throw new Error('Remote cloud file not found.')
      }

      const remoteData =
        await this.driveClient.downloadFile<UnifiedSyncPackage>(
          session.accessToken,
          remoteFile.id
        )
      this.isApplyingRemote = true
      try {
        await this.adapter.importAllSlots(remoteData)
      } finally {
        this.isApplyingRemote = false
      }

      this.updateConflict(null)
      this.updateState({
        status: 'IDLE',
        lastSyncTime: Date.now(),
        remoteFileId: remoteFile.id,
        remoteModifiedTime: remoteFile.modifiedTime,
        lastRemoteHash: remoteData.contentHash,
        isLocalDirty: false,
      })
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'Failed to apply cloud data'
      this.updateState({ status: 'ERROR', errorMessage: msg })
      throw err
    }
  }

  private buildConflictComparison(
    localSlots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<unknown>>,
    remotePackage: UnifiedSyncPackage,
    remoteFile: DriveFileMetadata
  ): ConflictComparison {
    const localSummaries = this.adapter!.getSlotSummaries(localSlots)
    const remoteSummaries = this.adapter!.getSlotSummaries(remotePackage.slots)

    const localBytes = JSON.stringify(localSlots).length
    const remoteBytes = JSON.stringify(remotePackage.slots).length

    const localTotalItems = Object.values(localSummaries).reduce(
      (sum, s) => sum + s.characterCount + s.artifactCount + s.weaponCount,
      0
    )
    const remoteTotalItems = Object.values(remoteSummaries).reduce(
      (sum, s) => sum + s.characterCount + s.artifactCount + s.weaponCount,
      0
    )

    // Check severe disparity (>25% item count, >35% byte size, or empty slot)
    const maxItems = Math.max(localTotalItems, remoteTotalItems)
    const minItems = Math.min(localTotalItems, remoteTotalItems)
    const itemDiffRatio = maxItems > 0 ? (maxItems - minItems) / maxItems : 0

    const maxBytes = Math.max(localBytes, remoteBytes)
    const minBytes = Math.min(localBytes, remoteBytes)
    const byteDiffRatio = maxBytes > 0 ? (maxBytes - minBytes) / maxBytes : 0

    const hasEmptySlotDisparity = ([1, 2, 3, 4] as const).some((slotNum) => {
      const lItems =
        localSummaries[slotNum].characterCount +
        localSummaries[slotNum].artifactCount +
        localSummaries[slotNum].weaponCount
      const rItems =
        remoteSummaries[slotNum].characterCount +
        remoteSummaries[slotNum].artifactCount +
        remoteSummaries[slotNum].weaponCount
      return (lItems === 0 && rItems > 0) || (rItems === 0 && lItems > 0)
    })

    const hasSevereDisparity =
      itemDiffRatio > 0.25 || byteDiffRatio > 0.35 || hasEmptySlotDisparity

    return {
      local: {
        timestamp: this.state.lastSyncTime ?? Date.now(),
        byteSize: localBytes,
        slots: localSummaries,
      },
      cloud: {
        timestamp: new Date(remoteFile.modifiedTime).getTime(),
        byteSize: remoteBytes,
        slots: remoteSummaries,
      },
      hasSevereDisparity,
      disparityWarningText: hasSevereDisparity
        ? 'Caution: One version has substantially less data than the other.'
        : undefined,
    }
  }

  private loadCachedMetadata(): SyncRuntimeMetadata | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(SYNC_METADATA_STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as SyncRuntimeMetadata
    } catch {
      return null
    }
  }

  private saveCachedMetadata(metadata: SyncRuntimeMetadata): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(SYNC_METADATA_STORAGE_KEY, JSON.stringify(metadata))
    } catch (e) {
      console.error('Failed to save sync metadata to localStorage', e)
    }
  }
}
