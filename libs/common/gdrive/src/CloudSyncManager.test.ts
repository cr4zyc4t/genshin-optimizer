import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  CloudSyncManager,
  DEFAULT_FOCUS_THROTTLE_MS,
  DEFAULT_SYNC_DEBOUNCE_MS,
  DEFAULT_SYNC_MAX_WAIT_MS,
} from './CloudSyncManager'
import { GoogleIdentityClient } from './GoogleIdentityClient'
import { GoogleDriveApiClient } from './GoogleDriveApiClient'
import type { MultiSlotDataAdapter } from './adapter'
import type {
  CloudAccountSession,
  UnifiedSlotEntry,
  UnifiedSyncPackage,
} from './types'

describe('CloudSyncManager', () => {
  let identityClient: GoogleIdentityClient
  let driveClient: GoogleDriveApiClient
  let adapter: MultiSlotDataAdapter
  let syncManager: CloudSyncManager

  const mockSession: CloudAccountSession = {
    email: 'traveler@teyvat.org',
    name: 'Lumine',
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600 * 1000,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  }

  const mockSlots: Record<1 | 2 | 3 | 4, UnifiedSlotEntry<any>> = {
    1: { name: 'Main', lastEdit: 1000, data: { characters: ['Lumine'] } },
    2: { name: 'Slot 2', lastEdit: 0, data: {} },
    3: { name: 'Slot 3', lastEdit: 0, data: {} },
    4: { name: 'Slot 4', lastEdit: 0, data: {} },
  }

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.restoreAllMocks()

    identityClient = new GoogleIdentityClient({ clientId: 'test-client' })
    vi.spyOn(identityClient, 'loadCachedSession').mockReturnValue(mockSession)

    driveClient = new GoogleDriveApiClient()

    adapter = {
      appId: 'genshin-optimizer',
      exportAllSlots: vi.fn().mockResolvedValue({
        slots: mockSlots,
        contentHash: 'hash-v1',
      }),
      importAllSlots: vi.fn().mockResolvedValue(undefined),
      subscribeToChanges: vi.fn().mockReturnValue(() => {}),
      getSlotSummaries: vi.fn().mockReturnValue({
        1: {
          name: 'Main',
          lastEdit: 1000,
          characterCount: 1,
          artifactCount: 0,
          weaponCount: 0,
        },
        2: {
          name: 'Slot 2',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        3: {
          name: 'Slot 3',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        4: {
          name: 'Slot 4',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
      }),
      isLocalEmpty: vi.fn().mockReturnValue(false),
    }

    syncManager = new CloudSyncManager(identityClient, driveClient, {
      debounceMs: 2000,
      maxWaitMs: 6000,
    })
    syncManager.setAdapter(adapter)
  })

  afterEach(() => {
    syncManager.stop()
    vi.useRealTimers()
  })

  it('exports default sync debounce, maxWait, and focus throttle constants', () => {
    expect(typeof DEFAULT_SYNC_DEBOUNCE_MS).toBe('number')
    expect(typeof DEFAULT_SYNC_MAX_WAIT_MS).toBe('number')
    expect(DEFAULT_SYNC_DEBOUNCE_MS).toBeGreaterThan(0)
    expect(DEFAULT_SYNC_MAX_WAIT_MS).toBeGreaterThan(0)
    expect(DEFAULT_FOCUS_THROTTLE_MS).toBe(60000)
  })

  it('debounces local data mutations by 2 seconds before initiating sync', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    syncManager.notifyDataChanged()
    expect(syncManager.getState().status).toBe('DEBOUNCING')

    // Advance 1 second - should still be debouncing
    vi.advanceTimersByTime(1000)
    expect(syncManager.getState().status).toBe('DEBOUNCING')
    expect(driveClient.findFile).not.toHaveBeenCalled()

    // Another edit resets timer
    syncManager.notifyDataChanged()
    vi.advanceTimersByTime(1000)
    expect(driveClient.findFile).not.toHaveBeenCalled()

    // Advance remaining 1 second (total 2s from second edit)
    await vi.advanceTimersByTimeAsync(1000)

    expect(driveClient.findFile).toHaveBeenCalled()
    expect(driveClient.createFile).toHaveBeenCalled()
    expect(syncManager.getState().status).toBe('IDLE')
  })

  it('triggers sync after maxWait (6s) when mutations occur frequently without 2s pause', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    // Simulate frequent changes every 500ms for 5.5s (11 edits)
    for (let i = 0; i < 11; i++) {
      syncManager.notifyDataChanged()
      vi.advanceTimersByTime(500)
      expect(driveClient.findFile).not.toHaveBeenCalled()
      expect(syncManager.getState().status).toBe('DEBOUNCING')
    }

    // Advance remaining 500ms to reach 6000ms (DEFAULT_SYNC_MAX_WAIT_MS)
    await vi.advanceTimersByTimeAsync(500)

    expect(driveClient.findFile).toHaveBeenCalled()
    expect(driveClient.createFile).toHaveBeenCalled()
    expect(syncManager.getState().status).toBe('IDLE')
  })

  it('performs focus sync check immediately when window focus triggers', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    await syncManager.handleWindowFocus()

    expect(driveClient.findFile).toHaveBeenCalled()
    expect(syncManager.getState().status).toBe('IDLE')
  })

  it('throttles window focus sync by 60 seconds', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    // 1st focus: fires immediately
    await syncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // 2nd focus 10 seconds later: throttled, no new API call
    vi.advanceTimersByTime(10000)
    await syncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // 3rd focus after 60s total (advance 50s more): runs sync
    vi.advanceTimersByTime(50000)
    await syncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(2)
  })

  it('respects custom focusThrottleMs option', async () => {
    const customSyncManager = new CloudSyncManager(
      identityClient,
      driveClient,
      {
        focusThrottleMs: 5000,
      }
    )
    customSyncManager.setAdapter(adapter)

    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    await customSyncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // Throttled at 2s
    vi.advanceTimersByTime(2000)
    await customSyncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // Allowed after 5s total
    vi.advanceTimersByTime(3000)
    await customSyncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(2)

    customSyncManager.stop()
  })

  it('guards against concurrent in-flight syncs', async () => {
    let resolveFindFile!: (val: any) => void
    const findFilePromise = new Promise((resolve) => {
      resolveFindFile = resolve
    })
    vi.spyOn(driveClient, 'findFile').mockImplementation(
      () => findFilePromise as any
    )
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    // Start 1st sync (which will hang until resolveFindFile)
    const sync1 = syncManager.sync()
    expect(syncManager.getState().status).toBe('SYNCING')
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // Calling handleWindowFocus while sync is in-flight should be ignored
    await syncManager.handleWindowFocus()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // Calling sync() while sync is in-flight returns the existing in-flight promise
    const sync2 = syncManager.sync()
    expect(driveClient.findFile).toHaveBeenCalledTimes(1)

    // Resolve the in-flight promise
    resolveFindFile(null)
    await Promise.all([sync1, sync2])

    expect(syncManager.getState().status).toBe('IDLE')
    expect(driveClient.createFile).toHaveBeenCalledTimes(1)
  })

  it('automatically restores cloud data on fresh device with empty local slots', async () => {
    vi.spyOn(adapter, 'isLocalEmpty').mockReturnValue(true)

    const remotePackage: UnifiedSyncPackage = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 1000,
      contentHash: 'remote-hash',
      slots: mockSlots,
    }

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })
    vi.spyOn(driveClient, 'downloadFile').mockResolvedValue(remotePackage)

    await syncManager.handleWindowFocus()

    expect(adapter.importAllSlots).toHaveBeenCalledWith(remotePackage)
    expect(syncManager.getState().status).toBe('IDLE')
  })

  it('bypasses debounce on forceUpload', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })
    vi.spyOn(driveClient, 'updateFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:05:00Z',
    })

    await syncManager.forceUpload()

    expect(driveClient.updateFile).toHaveBeenCalled()
    expect(syncManager.getState().status).toBe('IDLE')
  })

  it('triggers CONFLICT state when both local is dirty and remote has divergent changes', async () => {
    const remotePackage: UnifiedSyncPackage = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 2000,
      contentHash: 'remote-divergent-hash',
      slots: mockSlots,
    }

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T13:00:00Z',
    })
    vi.spyOn(driveClient, 'downloadFile').mockResolvedValue(remotePackage)

    // Mark local as dirty
    syncManager.notifyDataChanged()
    expect(syncManager.getState().isLocalDirty).toBe(true)

    // Advance debounce
    await vi.advanceTimersByTimeAsync(2000)

    expect(syncManager.getState().status).toBe('CONFLICT')
    expect(syncManager.getActiveConflict()).not.toBeNull()
    expect(adapter.importAllSlots).not.toHaveBeenCalled()
  })

  it('downloads and updates local when remote is newer and local has clean baseline', async () => {
    // Set a known prior sync state where local was clean
    syncManager['updateState']({
      lastRemoteHash: 'old-hash',
      remoteModifiedTime: '2026-09-05T11:00:00Z',
      isLocalDirty: false,
    })

    const remotePackage: UnifiedSyncPackage = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 3000,
      contentHash: 'remote-newer-hash',
      slots: mockSlots,
    }

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })
    vi.spyOn(driveClient, 'downloadFile').mockResolvedValue(remotePackage)

    await syncManager.sync()

    expect(adapter.importAllSlots).toHaveBeenCalledWith(remotePackage)
    expect(syncManager.getState().status).toBe('IDLE')
    expect(syncManager.getState().lastRemoteHash).toBe('remote-newer-hash')
  })

  it('triggers conflict instead of silent overwrite when connecting with existing non-empty local data and divergent cloud data', async () => {
    // Initial state: lastRemoteHash is null (never synced), but local is not empty
    expect(syncManager.getState().lastRemoteHash).toBeNull()
    vi.spyOn(adapter, 'isLocalEmpty').mockReturnValue(false)

    const remotePackage: UnifiedSyncPackage = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 4000,
      contentHash: 'diverged-cloud-hash',
      slots: mockSlots,
    }

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })
    vi.spyOn(driveClient, 'downloadFile').mockResolvedValue(remotePackage)

    await syncManager.sync()

    // Must trigger CONFLICT, NOT silent overwrite!
    expect(syncManager.getState().status).toBe('CONFLICT')
    expect(syncManager.getActiveConflict()).not.toBeNull()
    expect(adapter.importAllSlots).not.toHaveBeenCalled()
  })

  it('uploads local changes when local is dirty and remote is not newer', async () => {
    syncManager['updateState']({
      lastRemoteHash: 'hash-v1',
      remoteModifiedTime: '2026-09-05T12:00:00Z',
      isLocalDirty: true,
    })

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z', // same timestamp, not newer
    })
    vi.spyOn(driveClient, 'updateFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:30:00Z',
    })

    await syncManager.sync()

    expect(driveClient.updateFile).toHaveBeenCalled()
    expect(syncManager.getState().status).toBe('IDLE')
    expect(syncManager.getState().isLocalDirty).toBe(false)
  })

  it('resolves conflict with cloud data via resolveWithCloud', async () => {
    const remotePackage: UnifiedSyncPackage = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 5000,
      contentHash: 'cloud-content-hash',
      slots: mockSlots,
    }

    vi.spyOn(driveClient, 'findFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })
    vi.spyOn(driveClient, 'downloadFile').mockResolvedValue(remotePackage)

    syncManager['updateState']({ status: 'CONFLICT' })

    await syncManager.resolveWithCloud()

    expect(adapter.importAllSlots).toHaveBeenCalledWith(remotePackage)
    expect(syncManager.getState().status).toBe('IDLE')
    expect(syncManager.getActiveConflict()).toBeNull()
  })

  it('records ERROR status and message when sync throws an exception', async () => {
    vi.spyOn(driveClient, 'findFile').mockRejectedValue(
      new Error('Network error connecting to Google Drive')
    )

    await expect(syncManager.sync()).rejects.toThrow(
      'Network error connecting to Google Drive'
    )

    expect(syncManager.getState().status).toBe('ERROR')
    expect(syncManager.getState().errorMessage).toBe(
      'Network error connecting to Google Drive'
    )
  })

  it('does not trigger state updates or storage writes when notifyDataChanged is called while unauthenticated', () => {
    vi.spyOn(identityClient, 'loadCachedSession').mockReturnValue(null)
    syncManager['updateState']({ status: 'UNAUTHENTICATED' })

    const listener = vi.fn()
    syncManager.subscribeState(listener)
    listener.mockClear()

    syncManager.notifyDataChanged('char update')

    expect(listener).not.toHaveBeenCalled()
  })

  it('clears error and resets status when clearSession is called on disconnect', async () => {
    vi.spyOn(driveClient, 'findFile').mockRejectedValue(
      new Error('Failed to search appDataFolder: 401 Unauthorized')
    )

    await expect(syncManager.sync()).rejects.toThrow('401')
    expect(syncManager.getState().status).toBe('ERROR')
    expect(syncManager.getState().errorMessage).toContain('401')

    // User clicks Disconnect
    syncManager.clearSession()

    expect(syncManager.getState().status).toBe('UNAUTHENTICATED')
    expect(syncManager.getState().errorMessage).toBeNull()
    expect(syncManager.getActiveConflict()).toBeNull()
  })

  it('initializes with null errorMessage and UNAUTHENTICATED on page refresh without session', () => {
    // Stale error in localStorage from previous session
    localStorage.setItem(
      'gdrive_sync_metadata',
      JSON.stringify({
        status: 'ERROR',
        errorMessage: 'Failed to search appDataFolder: 403 Forbidden',
        lastSyncTime: 12345,
      })
    )
    vi.spyOn(identityClient, 'loadCachedSession').mockReturnValue(null)

    const freshManager = new CloudSyncManager(identityClient, driveClient)
    expect(freshManager.getState().status).toBe('UNAUTHENTICATED')
    expect(freshManager.getState().errorMessage).toBeNull()
  })
})
