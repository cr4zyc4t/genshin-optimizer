import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GenshinSlotAdapter } from './GenshinSlotAdapter'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { createTestDBStorage } from '@genshin-optimizer/common/database'
import type { UnifiedSyncPackage } from '@genshin-optimizer/common/gdrive'

describe('GenshinSlotAdapter', () => {
  let mockDbs: ArtCharDatabase[]
  let adapter: GenshinSlotAdapter

  beforeEach(() => {
    mockDbs = ([1, 2, 3, 4] as const).map((idx) => {
      return {
        chars: { keys: idx === 1 ? ['Amber'] : [] },
        arts: { keys: [] },
        weapons: { keys: [] },
        dbMeta: {
          get: () => ({ name: `Slot ${idx}`, lastEdit: 1000 * idx }),
          set: vi.fn(),
          follow: vi.fn().mockReturnValue(() => {}),
        },
        exportGOOD: vi.fn().mockReturnValue({
          format: 'GOOD',
          version: 3,
          characters: idx === 1 ? [{ key: 'Amber' }] : [],
          artifacts: [],
          weapons: [],
        }),
        importGOOD: vi.fn(),
        clear: vi.fn(),
        toExtraLocalDB: vi.fn(),
      } as unknown as ArtCharDatabase
    })

    adapter = new GenshinSlotAdapter(mockDbs)
  })

  it('exports all 4 slots with slot metadata and content hash', async () => {
    const exported = await adapter.exportAllSlots()

    expect(exported.slots[1].name).toBe('Slot 1')
    expect(exported.slots[1].data.characters.length).toBe(1)
    expect(exported.slots[2].name).toBe('Slot 2')
    expect(exported.slots[3].name).toBe('Slot 3')
    expect(exported.slots[4].name).toBe('Slot 4')
    expect(exported.contentHash).toBeDefined()
  })

  it('imports all 4 slots into corresponding databases', async () => {
    const pkg: UnifiedSyncPackage<unknown> = {
      version: 1,
      appId: 'genshin-optimizer',
      createdAt: 5000,
      contentHash: 'hash-abc',
      slots: {
        1: {
          name: 'Main',
          lastEdit: 5000,
          data: { characters: [{ key: 'Lumine' }] },
        },
        2: { name: 'Alt', lastEdit: 4000, data: {} },
        3: { name: 'Slot 3', lastEdit: 3000, data: {} },
        4: { name: 'Slot 4', lastEdit: 2000, data: {} },
      },
    }

    await adapter.importAllSlots(pkg)

    expect(mockDbs[0].clear).toHaveBeenCalled()
    expect(mockDbs[0].importGOOD).toHaveBeenCalledWith(
      pkg.slots[1].data,
      false,
      false,
      false
    )
    expect(mockDbs[0].toExtraLocalDB).toHaveBeenCalled()
  })

  it('computes slot summaries correctly', () => {
    const summaries = adapter.getSlotSummaries({
      1: {
        name: 'Main',
        lastEdit: 1000,
        data: {
          characters: [{ key: 'Amber' }],
          artifacts: [{}, {}],
          weapons: [{}],
        },
      },
      2: { name: 'Alt', lastEdit: 0, data: {} },
      3: { name: 'Slot 3', lastEdit: 0, data: {} },
      4: { name: 'Slot 4', lastEdit: 0, data: {} },
    })

    expect(summaries[1].characterCount).toBe(1)
    expect(summaries[1].artifactCount).toBe(2)
    expect(summaries[1].weaponCount).toBe(1)
    expect(summaries[2].characterCount).toBe(0)
  })

  it('correctly reports when local storage is not empty', () => {
    expect(adapter.isLocalEmpty()).toBe(false)
  })

  it('correctly reports when local storage is empty', () => {
    mockDbs[0].chars.keys = []
    expect(adapter.isLocalEmpty()).toBe(true)
  })

  it('notifies on team change and build add/remove with real ArtCharDatabase', () => {
    const realDb1 = new ArtCharDatabase(1, createTestDBStorage('go'))
    const realDb2 = new ArtCharDatabase(2, createTestDBStorage('go'))
    const realDb3 = new ArtCharDatabase(3, createTestDBStorage('go'))
    const realDb4 = new ArtCharDatabase(4, createTestDBStorage('go'))
    const realAdapter = new GenshinSlotAdapter([
      realDb1,
      realDb2,
      realDb3,
      realDb4,
    ])
    const changeListener = vi.fn()
    realAdapter.subscribeToChanges(changeListener)

    // 1. Team addition and edit
    const teamId = realDb1.teams.new()
    expect(changeListener).toHaveBeenCalled()
    changeListener.mockClear()

    realDb1.teams.set(teamId, { name: 'Super Team' })
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('teams update')
    )
    changeListener.mockClear()

    // 2. Build addition and removal
    const buildId = realDb1.builds.new({ characterKey: 'Amber' })
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('builds')
    )
    changeListener.mockClear()

    realDb1.builds.remove(buildId)
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('builds remove')
    )
    changeListener.mockClear()

    // 3. TC Build addition and removal
    const buildTcId = realDb1.buildTcs.newFromBuild('Amber')!
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('buildTcs')
    )
    changeListener.mockClear()

    realDb1.buildTcs.remove(buildTcId)
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('buildTcs remove')
    )
    changeListener.mockClear()

    // 4. Verify that after importAllSlots (which invokes db.clear()), listeners still work
    realDb1.clear()
    changeListener.mockClear()

    realDb1.builds.new({ characterKey: 'Amber' })
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('builds')
    )
    changeListener.mockClear()

    realDb1.teams.set(teamId, { name: 'After Clear Team' })
    expect(changeListener).toHaveBeenCalledWith(
      expect.stringContaining('teams update')
    )
  })
})
