import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GenshinSlotAdapter } from './GenshinSlotAdapter'
import type { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import type { UnifiedSyncPackage } from '@genshin-optimizer/common/gdrive'
import type {
  StorageWriteEvent,
  StorageWriteListener,
} from '@genshin-optimizer/common/database'

describe('GenshinSlotAdapter', () => {
  let mockDbs: ArtCharDatabase[]
  let adapter: GenshinSlotAdapter
  let registeredListener: StorageWriteListener | null
  let mockUnsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    registeredListener = null
    mockUnsubscribe = vi.fn()

    mockDbs = ([1, 2, 3, 4] as const).map((idx) => {
      return {
        chars: { keys: idx === 1 ? ['Amber'] : [] },
        arts: { keys: [] },
        weapons: { keys: [] },
        dbMeta: {
          get: () => ({ name: `Slot ${idx}`, lastEdit: 1000 * idx }),
          set: vi.fn(),
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

    adapter = new GenshinSlotAdapter(mockDbs, {
      subscribeStorage: (listener) => {
        registeredListener = listener
        return mockUnsubscribe
      },
    })
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

  it('subscribes to storage proxy and notifies on non-blacklisted setItem and removeItem (US1)', () => {
    const changeListener = vi.fn()
    adapter.subscribeToChanges(changeListener)

    expect(registeredListener).toBeDefined()

    // 1. Non-blacklisted setItem
    registeredListener!({
      type: 'setItem',
      key: 'artifact_123',
      value: '{}',
      source: 'method',
    })
    expect(changeListener).toHaveBeenCalledWith('storage:setItem:artifact_123')
    changeListener.mockClear()

    // 2. Non-blacklisted removeItem
    registeredListener!({
      type: 'removeItem',
      key: 'char_amber',
      source: 'method',
    })
    expect(changeListener).toHaveBeenCalledWith('storage:removeItem:char_amber')
  })

  it('filters out blacklisted keys from notifying subscribers (US2)', () => {
    const changeListener = vi.fn()
    adapter.subscribeToChanges(changeListener)

    const blacklistedEvents: StorageWriteEvent[] = [
      {
        type: 'setItem',
        key: 'gdrive_sync_metadata',
        value: '{}',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'gdrive_auth_session',
        value: '{}',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'gdrive_temp',
        value: '1',
        source: 'method',
      },
      {
        type: 'removeItem',
        key: 'gdrive_sync_metadata',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'snow',
        value: 'on',
        source: 'method',
      },
      {
        type: 'removeItem',
        key: 'snow',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'silly',
        value: 'on',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'newTabKey',
        value: 'debug',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'infoShown_characters',
        value: 'true',
        source: 'method',
      },
      {
        type: 'setItem',
        key: 'infoShown_artifacts',
        value: 'true',
        source: 'method',
      },
    ]

    for (const evt of blacklistedEvents) {
      registeredListener!(evt)
    }

    expect(changeListener).not.toHaveBeenCalled()
  })

  it('unconditionally notifies on storage clear (US3)', () => {
    const changeListener = vi.fn()
    adapter.subscribeToChanges(changeListener)

    registeredListener!({
      type: 'clear',
      source: 'method',
    })

    expect(changeListener).toHaveBeenCalledWith('storage:clear')
  })

  it('manages subscription lifecycle and unregisters when subscriber count drops to zero', () => {
    const changeListener1 = vi.fn()
    const changeListener2 = vi.fn()

    const unsub1 = adapter.subscribeToChanges(changeListener1)
    const unsub2 = adapter.subscribeToChanges(changeListener2)

    registeredListener!({
      type: 'setItem',
      key: 'dbIndex',
      value: '2',
      source: 'method',
    })

    expect(changeListener1).toHaveBeenCalledTimes(1)
    expect(changeListener2).toHaveBeenCalledTimes(1)

    // Unsubscribe first listener
    unsub1()
    expect(mockUnsubscribe).not.toHaveBeenCalled()

    registeredListener!({
      type: 'setItem',
      key: 'dbIndex',
      value: '3',
      source: 'method',
    })

    expect(changeListener1).toHaveBeenCalledTimes(1)
    expect(changeListener2).toHaveBeenCalledTimes(2)

    // Unsubscribe second listener
    unsub2()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('updates databases cleanly without binding database manager listeners (US4)', () => {
    const newMockDbs = ([1, 2, 3, 4] as const).map((idx) => {
      return {
        chars: { keys: [`Char${idx}`] },
        arts: { keys: [] },
        weapons: { keys: [] },
        dbMeta: {
          get: () => ({ name: `Slot ${idx}`, lastEdit: 1000 * idx }),
        },
      } as unknown as ArtCharDatabase
    })

    adapter.updateDatabases(newMockDbs)
    expect(adapter.isLocalEmpty()).toBe(false)
  })
})
