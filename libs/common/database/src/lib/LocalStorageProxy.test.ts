import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DBLocalStorage } from './DBLocalStorage'
import {
  addGlobalStorageWriteListener,
  createLocalStorageProxy,
  getRawLocalStorage,
  installLocalStorageProxy,
  isLocalStorageProxied,
  type StorageWriteEvent,
  uninstallLocalStorageProxy,
} from './LocalStorageProxy'
import { createMockStorage } from './test-utils'

describe('LocalStorageProxy', () => {
  let mockStorage: Storage

  beforeEach(() => {
    mockStorage = createMockStorage()
  })

  afterEach(() => {
    uninstallLocalStorageProxy()
    vi.restoreAllMocks()
  })

  describe('createLocalStorageProxy', () => {
    it('logs to console on setItem', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage)

      proxy.setItem('myKey', 'myValue')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LocalStorageProxy] setItem "myKey":',
        'myValue'
      )
      expect(mockStorage.getItem('myKey')).toBe('myValue')
      expect(proxy.getItem('myKey')).toBe('myValue')
    })

    it('logs to console on removeItem', () => {
      mockStorage.setItem('removeKey', 'value')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage)

      proxy.removeItem('removeKey')

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LocalStorageProxy] removeItem "removeKey"'
      )
      expect(mockStorage.getItem('removeKey')).toBeNull()
      expect(proxy.getItem('removeKey')).toBeNull()
    })

    it('logs to console on clear', () => {
      mockStorage.setItem('key1', 'v1')
      mockStorage.setItem('key2', 'v2')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage)

      proxy.clear()

      expect(consoleSpy).toHaveBeenCalledWith('[LocalStorageProxy] clear')
      expect(mockStorage.length).toBe(0)
      expect(proxy.length).toBe(0)
    })

    it('logs to console on direct property assignment', () => {
      interface CustomProxy {
        assignedProp?: string
      }
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage)

      ;(proxy as unknown as CustomProxy).assignedProp = 'propValue'

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LocalStorageProxy] setProperty "assignedProp":',
        'propValue'
      )
      expect(mockStorage.getItem('assignedProp')).toBe('propValue')
      expect((proxy as unknown as CustomProxy).assignedProp).toBe('propValue')
    })

    it('logs to console on direct property deletion', () => {
      interface CustomProxy {
        deleteMe?: string
      }
      mockStorage.setItem('deleteMe', 'val')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage)

      delete (proxy as unknown as CustomProxy).deleteMe

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LocalStorageProxy] deleteProperty "deleteMe"'
      )
      expect(mockStorage.getItem('deleteMe')).toBeNull()
    })

    it('supports custom logger function', () => {
      const customLogger = vi.fn()
      const proxy = createLocalStorageProxy(mockStorage, {
        logger: customLogger,
      })

      proxy.setItem('k', 'v')

      expect(customLogger).toHaveBeenCalledWith(
        '[LocalStorageProxy] setItem "k":',
        'v'
      )
    })

    it('respects logToConsole: false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const proxy = createLocalStorageProxy(mockStorage, {
        logToConsole: false,
      })

      proxy.setItem('k', 'v')
      proxy.removeItem('k')
      proxy.clear()

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('calls onWrite option and listeners registered via addWriteListener', () => {
      const events: StorageWriteEvent[] = []
      const onWriteSpy = vi.fn((e: StorageWriteEvent) => events.push(e))
      const listenerSpy = vi.fn((e: StorageWriteEvent) => events.push(e))

      const proxy = createLocalStorageProxy(mockStorage, {
        logToConsole: false,
        onWrite: onWriteSpy,
      })

      const unsubscribe = proxy.addWriteListener(listenerSpy)

      proxy.setItem('key1', 'val1')
      proxy.removeItem('key1')
      proxy.clear()

      expect(onWriteSpy).toHaveBeenCalledTimes(3)
      expect(listenerSpy).toHaveBeenCalledTimes(3)
      expect(events).toEqual([
        {
          type: 'setItem',
          key: 'key1',
          value: 'val1',
          source: 'method',
        },
        {
          type: 'setItem',
          key: 'key1',
          value: 'val1',
          source: 'method',
        },
        {
          type: 'removeItem',
          key: 'key1',
          source: 'method',
        },
        {
          type: 'removeItem',
          key: 'key1',
          source: 'method',
        },
        {
          type: 'clear',
          source: 'method',
        },
        {
          type: 'clear',
          source: 'method',
        },
      ])

      unsubscribe()
      proxy.setItem('key2', 'val2')
      expect(listenerSpy).toHaveBeenCalledTimes(3)
      expect(onWriteSpy).toHaveBeenCalledTimes(4)
    })

    it('provides rawStorage access', () => {
      const proxy = createLocalStorageProxy(mockStorage)
      expect(proxy.rawStorage).toBe(mockStorage)
    })

    it('supports Object.keys, Object.entries, and in operator', () => {
      const proxy = createLocalStorageProxy(mockStorage, {
        logToConsole: false,
      })
      proxy.setItem('keyA', 'valA')
      proxy.setItem('keyB', 'valB')

      expect(Object.keys(proxy).sort()).toEqual(['keyA', 'keyB'].sort())
      expect(Object.entries(proxy).sort()).toEqual(
        [
          ['keyA', 'valA'],
          ['keyB', 'valB'],
        ].sort()
      )
      expect('keyA' in proxy).toBe(true)
      expect('keyC' in proxy).toBe(false)
    })
  })

  describe('Integration with DBLocalStorage', () => {
    it('captures writes from DBLocalStorage methods', () => {
      const logCalls: string[] = []
      const customLogger = (msg: string, ...args: unknown[]) => {
        logCalls.push(`${msg} ${args.join(' ')}`.trim())
      }
      const proxy = createLocalStorageProxy(mockStorage, {
        logger: customLogger,
      })
      const dbStorage = new DBLocalStorage(proxy, 'go')

      dbStorage.set('test_obj', { num: 42 })
      expect(logCalls).toContain(
        '[LocalStorageProxy] setItem "test_obj": {"num":42}'
      )
      expect(dbStorage.get('test_obj')).toEqual({ num: 42 })

      dbStorage.setString('simple_key', 'text')
      expect(logCalls).toContain(
        '[LocalStorageProxy] setItem "simple_key": text'
      )

      dbStorage.remove('simple_key')
      expect(logCalls).toContain('[LocalStorageProxy] removeItem "simple_key"')

      dbStorage.clear()
      expect(logCalls).toContain('[LocalStorageProxy] clear')
    })
  })

  describe('installLocalStorageProxy & uninstallLocalStorageProxy', () => {
    interface GlobalWithStorage {
      localStorage?: Storage
    }
    let originalGlobalLocalStorage: Storage | undefined
    const globalObj = globalThis as unknown as GlobalWithStorage

    beforeEach(() => {
      originalGlobalLocalStorage = globalObj.localStorage
      globalObj.localStorage = createMockStorage()
    })

    afterEach(() => {
      uninstallLocalStorageProxy()
      if (originalGlobalLocalStorage !== undefined) {
        globalObj.localStorage = originalGlobalLocalStorage
      } else {
        delete globalObj.localStorage
      }
    })

    it('installs proxy on global localStorage and intercepts writes', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const globalEventSpy = vi.fn()
      const unsub = addGlobalStorageWriteListener(globalEventSpy)

      expect(isLocalStorageProxied()).toBe(false)
      const proxy = installLocalStorageProxy()
      expect(isLocalStorageProxied()).toBe(true)
      expect(globalThis.localStorage).toBe(proxy)
      expect(getRawLocalStorage()).toBeDefined()

      localStorage.setItem('installedKey', 'installedVal')

      expect(logSpy).toHaveBeenCalledWith(
        '[LocalStorageProxy] setItem "installedKey":',
        'installedVal'
      )
      expect(globalEventSpy).toHaveBeenCalledWith({
        type: 'setItem',
        key: 'installedKey',
        value: 'installedVal',
        source: 'method',
      })

      unsub()
      uninstallLocalStorageProxy()
      expect(isLocalStorageProxied()).toBe(false)
    })
  })
})
