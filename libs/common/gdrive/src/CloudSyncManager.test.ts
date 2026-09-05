import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CloudSyncManager } from './CloudSyncManager'
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
      debounceMs: 10000,
    })
    syncManager.setAdapter(adapter)
  })

  afterEach(() => {
    syncManager.stop()
    vi.useRealTimers()
  })

  it('debounces local data mutations by 10 seconds before initiating sync', async () => {
    vi.spyOn(driveClient, 'findFile').mockResolvedValue(null)
    vi.spyOn(driveClient, 'createFile').mockResolvedValue({
      id: 'file-1',
      name: 'genshin_optimizer_sync.json',
      modifiedTime: '2026-09-05T12:00:00Z',
    })

    syncManager.notifyDataChanged()
    expect(syncManager.getState().status).toBe('DEBOUNCING')

    // Advance 5 seconds - should still be debouncing
    vi.advanceTimersByTime(5000)
    expect(syncManager.getState().status).toBe('DEBOUNCING')
    expect(driveClient.findFile).not.toHaveBeenCalled()

    // Another edit resets timer
    syncManager.notifyDataChanged()
    vi.advanceTimersByTime(5000)
    expect(driveClient.findFile).not.toHaveBeenCalled()

    // Advance remaining 5 seconds (total 10s from second edit)
    await vi.advanceTimersByTimeAsync(5000)

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
})
