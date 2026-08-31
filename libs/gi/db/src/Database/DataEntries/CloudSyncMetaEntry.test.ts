import { createTestDBStorage } from '@genshin-optimizer/common/database'
import { ArtCharDatabase } from '../ArtCharDatabase'

describe('CloudSyncMetaEntry', () => {
  let database: ArtCharDatabase
  let cloudSyncMeta: ArtCharDatabase['cloudSyncMeta']

  beforeEach(() => {
    const dbStorage = createTestDBStorage('go')
    database = new ArtCharDatabase(1, dbStorage)
    cloudSyncMeta = database.cloudSyncMeta
  })

  it('defaults to disabled with no remote file yet', () => {
    expect(cloudSyncMeta.get()).toEqual({ enabled: false })
  })

  it('persists updates via set()', () => {
    cloudSyncMeta.set({
      enabled: true,
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 123,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
      lastSyncedSize: 456,
    })
    expect(cloudSyncMeta.get()).toEqual({
      enabled: true,
      remoteFileId: 'file1',
      lastSyncedLocalEdit: 123,
      lastSyncedRemoteModifiedTime: '2026-01-01T00:00:00Z',
      lastSyncedSize: 456,
    })
  })

  it('is not included in exportGOOD (sync bookkeeping is not portable save data)', () => {
    cloudSyncMeta.set({ enabled: true, remoteFileId: 'file1' })
    const good = database.exportGOOD()
    expect((good as Record<string, unknown>)['cloudSyncMeta']).toBeUndefined()
  })

  it('is not overwritten by importGOOD', () => {
    cloudSyncMeta.set({ enabled: true, remoteFileId: 'file1' })
    database.importGOOD(
      { format: 'GOOD', cloudSyncMeta: { enabled: false } } as never,
      false,
      false,
      false
    )
    expect(cloudSyncMeta.get()).toEqual({
      enabled: true,
      remoteFileId: 'file1',
    })
  })
})
