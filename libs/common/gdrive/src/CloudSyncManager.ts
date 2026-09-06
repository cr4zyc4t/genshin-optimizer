import debounce from 'lodash.debounce'
import type { MultiSlotDataAdapter } from './adapter'
import { buildConflictComparison } from './conflict'
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

export const DEFAULT_SYNC_DEBOUNCE_MS = 3000
export const DEFAULT_SYNC_MAX_WAIT_MS = 6000
export const DEFAULT_DEBOUNCE_MS = DEFAULT_SYNC_DEBOUNCE_MS
export const DEFAULT_MAX_WAIT_MS = DEFAULT_SYNC_MAX_WAIT_MS

export interface CloudSyncManagerOptions {
  debounceMs?: number | undefined
  maxWaitMs?: number | undefined
  syncFileName?: string | undefined
}

export class CloudSyncManager {
  private identityClient: GoogleIdentityClient
  private driveClient: GoogleDriveApiClient
  private adapter: MultiSlotDataAdapter | null = null

  private debounceMs: number
  private maxWaitMs: number
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
    this.debounceMs = options.debounceMs ?? DEFAULT_SYNC_DEBOUNCE_MS
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_SYNC_MAX_WAIT_MS
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

    this.debouncedSyncFn = debounce(
      () => {
        this.sync().catch((err) => {
          console.error('[CloudSync] Debounced sync failed:', err)
        })
      },
      this.debounceMs,
      { maxWait: this.maxWaitMs }
    )
  }

  public setAdapter(adapter: MultiSlotDataAdapter): void {
    const prevAdapter = this.adapter
    this.adapter = adapter
    this.syncFileName = `${adapter.appId}_sync.json`
    if (this.unsubscribeDbChanges && prevAdapter !== adapter) {
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
    const hasChanged = Object.entries(partial).some(
      ([k, v]) => this.state[k as keyof SyncRuntimeMetadata] !== v
    )
    if (!hasChanged) return

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

    if (this.adapter) {
      this.unsubscribeDbChanges = this.adapter.subscribeToChanges((reason) => {
        this.notifyDataChanged(reason)
      })
    }

    if (typeof window !== 'undefined') {
      this.focusHandler = () => {
        this.handleWindowFocus().catch(console.error)
      }
      window.addEventListener('focus', this.focusHandler)
    }
  }

  /**
   * Stop listeners and cancel pending timers.
   */
  public stop(): void {
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
   * Called when local database data changes. Starts/resets debounced sync timer.
   */
  public notifyDataChanged(_reason?: string): void {
    if (this.isApplyingRemote) {
      return
    }

    const session = this.identityClient.loadCachedSession()
    if (!session) {
      if (this.state.status !== 'UNAUTHENTICATED') {
        this.updateState({ status: 'UNAUTHENTICATED' })
      }
      return
    }

    // If currently in unresolved conflict, do not trigger auto sync
    if (this.state.status === 'CONFLICT') {
      return
    }

    this.updateState({ isLocalDirty: true, status: 'DEBOUNCING' })
    this.debouncedSyncFn()
  }

  /**
   * Triggered on initial window focus in session.
   */
  public async handleWindowFocus(): Promise<void> {
    const session = this.identityClient.loadCachedSession()
    if (!session) {
      if (this.state.status !== 'UNAUTHENTICATED') {
        this.updateState({ status: 'UNAUTHENTICATED' })
      }
      return
    }

    if (this.state.status === 'CONFLICT') {
      return
    }

    await this.sync()
  }

  /**
   * Core synchronization operation.
   */
  public async sync(): Promise<void> {
    if (!this.adapter) {
      return
    }

    let session = this.identityClient.loadCachedSession()
    if (!session) {
      if (this.state.status !== 'UNAUTHENTICATED') {
        this.updateState({ status: 'UNAUTHENTICATED' })
      }
      return
    }

    if (this.identityClient.shouldRenewSession(session)) {
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
          this.updateState({ status: 'IDLE', isLocalDirty: false })
          return
        }

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
        return
      }

      // Case 2: Remote file exists
      const isRemoteNewer =
        !this.state.remoteModifiedTime ||
        remoteFile.modifiedTime > this.state.remoteModifiedTime

      // If local is completely empty (fresh device/browser), auto-restore remote without conflict
      if (this.adapter.isLocalEmpty()) {
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
        return
      }

      const { slots: localSlots, contentHash: localHash } =
        await this.adapter.exportAllSlots()

      // Case 3: Both local and remote have changes -> Potential Conflict
      if (this.state.isLocalDirty && isRemoteNewer) {
        const remoteData =
          await this.driveClient.downloadFile<UnifiedSyncPackage>(
            session.accessToken,
            remoteFile.id
          )

        if (remoteData.contentHash !== localHash) {
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
        const remoteData =
          await this.driveClient.downloadFile<UnifiedSyncPackage>(
            session.accessToken,
            remoteFile.id
          )

        // Safety check: If local has data and has never established a sync baseline with this cloud file,
        // and cloud content diverges from local content, trigger conflict instead of silently overwriting!
        if (
          this.state.lastRemoteHash === null &&
          !this.adapter.isLocalEmpty() &&
          remoteData.contentHash !== localHash
        ) {
          const conflict = this.buildConflictComparison(
            localSlots,
            remoteData,
            remoteFile
          )
          this.updateConflict(conflict)
          this.updateState({ status: 'CONFLICT' })
          return
        }

        // Only re-import if remote data actually differs from local
        if (remoteData.contentHash !== localHash) {
          this.isApplyingRemote = true
          try {
            await this.adapter.importAllSlots(remoteData)
          } finally {
            this.isApplyingRemote = false
          }
        }

        this.updateState({
          status: 'IDLE',
          lastSyncTime: Date.now(),
          remoteFileId: remoteFile.id,
          remoteModifiedTime: remoteFile.modifiedTime,
          lastRemoteHash: remoteData.contentHash,
          isLocalDirty: false,
        })
        return
      }

      // Case 5: Local is dirty and remote is not newer -> Upload local to Drive
      if (this.state.isLocalDirty) {
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
        return
      }

      // Case 6: In sync
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
    this.debouncedSyncFn.cancel()

    let session = this.identityClient.loadCachedSession()
    if (!session) {
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    if (this.identityClient.shouldRenewSession(session)) {
      const renewed = await this.identityClient.silentRefresh()
      if (renewed) session = renewed
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
    this.debouncedSyncFn.cancel()

    let session = this.identityClient.loadCachedSession()
    if (!session) {
      this.updateState({ status: 'UNAUTHENTICATED' })
      return
    }

    if (this.identityClient.shouldRenewSession(session)) {
      const renewed = await this.identityClient.silentRefresh()
      if (renewed) session = renewed
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

    return buildConflictComparison({
      localSummaries,
      cloudSummaries: remoteSummaries,
      localTimestamp: this.state.lastSyncTime ?? Date.now(),
      cloudTimestamp: new Date(remoteFile.modifiedTime).getTime(),
      localBytes,
      cloudBytes: remoteBytes,
    })
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
