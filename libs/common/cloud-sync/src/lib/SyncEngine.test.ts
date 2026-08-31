import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DriveClient } from './DriveClient'
import { SyncEngine } from './SyncEngine'
import type { CloudSyncMeta } from './types'

function makeDriveClient() {
  return {
    findFileIdByName: vi.fn(),
    getFileMetadata: vi.fn(),
    downloadFile: vi.fn(),
    createFile: vi.fn(),
    updateFile: vi.fn(),
  }
}

function makeEngine(driveClient: ReturnType<typeof makeDriveClient>) {
  let meta: CloudSyncMeta = { enabled: true }
  let localEdit = 0
  const applySnapshot = vi.fn()
  const engine = new SyncEngine({
    driveClient: driveClient as unknown as DriveClient,
    fileName: 'gi-slot-1.json',
    getMeta: () => meta,
    setMeta: (partial) => {
      meta = { ...meta, ...partial }
    },
    getLocalEdit: () => localEdit,
    getPayload: () => JSON.stringify({ hello: 'world' }),
    applySnapshot,
    getDebounceMs: () => 15_000,
  })
  return {
    engine,
    applySnapshot,
    setLocalEdit: (v: number) => {
      localEdit = v
    },
    setMeta: (partial: Partial<CloudSyncMeta>) => {
      meta = { ...meta, ...partial }
    },
    getMeta: () => meta,
  }
}

describe('SyncEngine.syncNow', () => {
  let driveClient: ReturnType<typeof makeDriveClient>

  beforeEach(() => {
    driveClient = makeDriveClient()
  })

  it('returns noop and does not touch Drive when disabled', async () => {
    const { engine, setMeta } = makeEngine(driveClient)
    setMeta({ enabled: false })
    const result = await engine.syncNow()
    expect(result).toBe('noop')
    expect(engine.getStatus()).toBe('disabled')
    expect(driveClient.findFileIdByName).not.toHaveBeenCalled()
  })

  it('creates the remote file on first sync (no remoteFileId yet)', async () => {
    const { engine } = makeEngine(driveClient)
    driveClient.findFileIdByName.mockResolvedValue(undefined)
    driveClient.createFile.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-01T00:00:00Z',
      size: 42,
    })
    const result = await engine.syncNow()
    expect(result).toBe('uploaded')
    expect(driveClient.createFile).toHaveBeenCalledWith(
      'gi-slot-1.json',
      expect.any(String)
    )
    expect(engine.getStatus()).toBe('synced')
  })

  it('noop when neither local nor remote changed since last sync', async () => {
    const { engine, setMeta, setLocalEdit } = makeEngine(driveClient)
    setLocalEdit(100)
    setMeta({
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 100,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
    })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-01T00:00:00Z',
    })
    const result = await engine.syncNow()
    expect(result).toBe('noop')
    expect(driveClient.updateFile).not.toHaveBeenCalled()
    expect(driveClient.downloadFile).not.toHaveBeenCalled()
    expect(engine.getStatus()).toBe('synced')
  })

  it('fast-forwards an upload when only local changed', async () => {
    const { engine, setMeta, setLocalEdit } = makeEngine(driveClient)
    setLocalEdit(200)
    setMeta({
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 100,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
    })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-01T00:00:00Z',
    })
    driveClient.updateFile.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-02T00:00:00Z',
      size: 10,
    })
    const result = await engine.syncNow()
    expect(result).toBe('uploaded')
    expect(driveClient.updateFile).toHaveBeenCalledTimes(1)
  })

  it('fast-forwards a download when only remote changed', async () => {
    const { engine, applySnapshot, setMeta, setLocalEdit } =
      makeEngine(driveClient)
    setLocalEdit(100)
    setMeta({
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 100,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
    })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-02T00:00:00Z',
      size: 55,
    })
    driveClient.downloadFile.mockResolvedValue('{"downloaded":true}')
    const result = await engine.syncNow()
    expect(result).toBe('downloaded')
    expect(applySnapshot).toHaveBeenCalledWith('{"downloaded":true}')
    expect(engine.getStatus()).toBe('synced')
  })

  it('surfaces a conflict when both local and remote changed', async () => {
    const { engine, applySnapshot, setMeta, setLocalEdit } =
      makeEngine(driveClient)
    setLocalEdit(200)
    setMeta({
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 100,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
    })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: '2026-01-02T00:00:00Z',
      size: 55,
    })
    const result = await engine.syncNow()
    expect(result).toBe('conflict')
    expect(engine.getStatus()).toBe('conflict')
    expect(driveClient.updateFile).not.toHaveBeenCalled()
    expect(applySnapshot).not.toHaveBeenCalled()
    const conflictInfo = engine.getConflictInfo()
    expect(conflictInfo?.local.modifiedTime).toBe(200)
    expect(conflictInfo?.cloud.modifiedTime).toBe(
      new Date('2026-01-02T00:00:00Z').getTime()
    )
    expect(conflictInfo?.cloud.size).toBe(55)
  })

  it('getConflictInfo returns undefined when there is no pending conflict', () => {
    const { engine } = makeEngine(driveClient)
    expect(engine.getConflictInfo()).toBeUndefined()
  })

  describe('resolveConflict', () => {
    async function setupConflict() {
      const ctx = makeEngine(driveClient)
      ctx.setLocalEdit(200)
      ctx.setMeta({
        remoteFileId: 'file1',
        lastSyncedLocalEdit: 100,
        lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
      })
      driveClient.getFileMetadata.mockResolvedValue({
        fileId: 'file1',
        modifiedTime: '2026-01-02T00:00:00Z',
        size: 55,
      })
      await ctx.engine.syncNow()
      return ctx
    }

    it('keepLocal force-overwrites the remote file', async () => {
      const { engine } = await setupConflict()
      driveClient.updateFile.mockResolvedValue({
        fileId: 'file1',
        modifiedTime: '2026-01-03T00:00:00Z',
        size: 10,
      })
      await engine.resolveConflict('keepLocal')
      expect(driveClient.updateFile).toHaveBeenCalledTimes(1)
      expect(engine.getStatus()).toBe('synced')
    })

    it('keepCloud downloads and applies the remote snapshot', async () => {
      const { engine, applySnapshot } = await setupConflict()
      driveClient.downloadFile.mockResolvedValue('{"cloud":true}')
      await engine.resolveConflict('keepCloud')
      expect(applySnapshot).toHaveBeenCalledWith('{"cloud":true}')
      expect(engine.getStatus()).toBe('synced')
    })
  })
})

describe('SyncEngine.notifyLocalEdit / debounced upload', () => {
  let driveClient: ReturnType<typeof makeDriveClient>

  beforeEach(() => {
    driveClient = makeDriveClient()
    vi.useFakeTimers()
  })

  it('does nothing when the slot is disabled', () => {
    const { engine, setMeta } = makeEngine(driveClient)
    setMeta({ enabled: false })
    engine.notifyLocalEdit()
    expect(engine.getStatus()).toBe('idle')
  })

  it('marks the engine dirty and uploads after the debounce elapses', async () => {
    const { engine, setMeta } = makeEngine(driveClient)
    setMeta({ remoteFileId: 'file1', lastSyncedRemoteModifiedTime: 't0' })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: 't0',
    })
    driveClient.updateFile.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: 't1',
      size: 5,
    })
    engine.notifyLocalEdit()
    expect(engine.getStatus()).toBe('dirty')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(driveClient.updateFile).toHaveBeenCalledTimes(1)
    expect(engine.getStatus()).toBe('synced')
  })

  it('routes to conflict instead of overwriting when remote changed since last sync', async () => {
    const { engine, setMeta } = makeEngine(driveClient)
    setMeta({ remoteFileId: 'file1', lastSyncedRemoteModifiedTime: 't0' })
    driveClient.getFileMetadata.mockResolvedValue({
      fileId: 'file1',
      modifiedTime: 't1-someone-else-changed-it',
    })
    engine.notifyLocalEdit()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(driveClient.updateFile).not.toHaveBeenCalled()
    expect(engine.getStatus()).toBe('conflict')
  })
})
