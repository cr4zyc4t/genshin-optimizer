export type StorageWriteType = 'setItem' | 'removeItem' | 'clear'
export type StorageWriteSource = 'method' | 'property'

export interface StorageWriteEvent {
  type: StorageWriteType
  key?: string
  value?: string
  source: StorageWriteSource
}

export type StorageWriteListener = (event: StorageWriteEvent) => void

export interface LocalStorageProxyOptions {
  /**
   * Whether to log write operations to the console.
   * Defaults to true.
   */
  logToConsole?: boolean

  /**
   * Custom logger function.
   * Defaults to console.log.
   */
  logger?: (message: string, ...args: unknown[]) => void

  /**
   * Optional callback invoked whenever a write operation occurs.
   */
  onWrite?: StorageWriteListener
}

export interface ProxiedStorage extends Storage {
  /**
   * Access to the underlying raw storage instance without proxy interception.
   */
  readonly rawStorage: Storage

  /**
   * Register a write listener on this storage instance.
   * Returns an unsubscribe function.
   */
  addWriteListener: (listener: StorageWriteListener) => () => void
}

const STORAGE_BUILTIN_PROPS = new Set([
  'getItem',
  'setItem',
  'removeItem',
  'clear',
  'key',
  'length',
  'rawStorage',
  'addWriteListener',
  'constructor',
  'toString',
  'valueOf',
  'toLocaleString',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
])

function isBuiltinProp(prop: string | symbol): boolean {
  if (typeof prop === 'symbol') return true
  if (STORAGE_BUILTIN_PROPS.has(prop)) return true
  if (typeof Storage !== 'undefined' && prop in Storage.prototype) return true
  return false
}

function logWriteEvent(
  event: StorageWriteEvent,
  logger: (message: string, ...args: unknown[]) => void
) {
  switch (event.type) {
    case 'setItem':
      if (event.source === 'property') {
        logger(`[LocalStorageProxy] setProperty "${event.key}":`, event.value)
      } else {
        logger(`[LocalStorageProxy] setItem "${event.key}":`, event.value)
      }
      break
    case 'removeItem':
      if (event.source === 'property') {
        logger(`[LocalStorageProxy] deleteProperty "${event.key}"`)
      } else {
        logger(`[LocalStorageProxy] removeItem "${event.key}"`)
      }
      break
    case 'clear':
      logger('[LocalStorageProxy] clear')
      break
  }
}

/**
 * Creates a Proxy wrapping any Storage instance (e.g. window.localStorage or mock Storage)
 * that intercepts all writing operations and logs them to the console.
 */
export function createLocalStorageProxy(
  targetStorage: Storage,
  options: LocalStorageProxyOptions = {}
): ProxiedStorage {
  const { logToConsole = true, logger = console.log, onWrite } = options
  const listeners = new Set<StorageWriteListener>()
  if (onWrite) {
    listeners.add(onWrite)
  }

  const notifyWrite = (event: StorageWriteEvent) => {
    if (logToConsole) {
      logWriteEvent(event, logger)
    }
    for (const listener of listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[LocalStorageProxy] Listener error:', err)
      }
    }
  }

  const addListener = (listener: StorageWriteListener): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const proxy = new Proxy(targetStorage, {
    get(target, prop, receiver) {
      if (prop === 'rawStorage') {
        return target
      }
      if (prop === 'addWriteListener') {
        return addListener
      }
      if (prop === 'setItem') {
        return (key: string, value: string) => {
          const strKey = String(key)
          const strVal = String(value)
          target.setItem(strKey, strVal)
          notifyWrite({
            type: 'setItem',
            key: strKey,
            value: strVal,
            source: 'method',
          })
        }
      }
      if (prop === 'removeItem') {
        return (key: string) => {
          const strKey = String(key)
          target.removeItem(strKey)
          notifyWrite({
            type: 'removeItem',
            key: strKey,
            source: 'method',
          })
        }
      }
      if (prop === 'clear') {
        return () => {
          target.clear()
          notifyWrite({
            type: 'clear',
            source: 'method',
          })
        }
      }
      if (prop === 'getItem') {
        return (key: string) => target.getItem(String(key))
      }
      if (prop === 'key') {
        return (index: number) => target.key(index)
      }
      if (prop === 'length') {
        return target.length
      }
      if (typeof prop === 'symbol') {
        return Reflect.get(target, prop, receiver)
      }
      if (isBuiltinProp(prop)) {
        const val = Reflect.get(target, prop, receiver)
        return typeof val === 'function' ? val.bind(target) : val
      }
      // Named item property access (e.g., localStorage.myKey)
      const item = target.getItem(prop)
      return item !== null ? item : undefined
    },

    set(target, prop, value, receiver) {
      if (typeof prop === 'string' && !isBuiltinProp(prop)) {
        const strVal = String(value)
        target.setItem(prop, strVal)
        notifyWrite({
          type: 'setItem',
          key: prop,
          value: strVal,
          source: 'property',
        })
        return true
      }
      return Reflect.set(target, prop, value, receiver)
    },

    deleteProperty(target, prop) {
      if (typeof prop === 'string' && !isBuiltinProp(prop)) {
        target.removeItem(prop)
        notifyWrite({
          type: 'removeItem',
          key: prop,
          source: 'property',
        })
        return true
      }
      return Reflect.deleteProperty(target, prop)
    },

    has(target, prop) {
      if (typeof prop === 'string' && !isBuiltinProp(prop)) {
        return target.getItem(prop) !== null
      }
      return Reflect.has(target, prop)
    },

    ownKeys(target) {
      const keys = new Set<string>()
      const len = target.length
      for (let i = 0; i < len; i++) {
        const k = target.key(i)
        if (k !== null) {
          keys.add(k)
        }
      }
      for (const k of Reflect.ownKeys(target)) {
        if (typeof k === 'string' && !isBuiltinProp(k)) {
          keys.add(k)
        }
      }
      return Array.from(keys)
    },

    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && !isBuiltinProp(prop)) {
        const val = target.getItem(prop)
        if (val !== null) {
          return {
            value: val,
            writable: true,
            enumerable: true,
            configurable: true,
          }
        }
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  })

  return proxy as ProxiedStorage
}

let activeProxy: ProxiedStorage | null = null
let originalStorage: Storage | null = null
const globalListeners = new Set<StorageWriteListener>()

/**
 * Installs the localStorage proxy on window.localStorage (or globalThis.localStorage).
 * Intercepts all subsequent write operations and outputs them to the console.
 */
export function installLocalStorageProxy(
  options: LocalStorageProxyOptions = {}
): ProxiedStorage | null {
  if (activeProxy) {
    if (options.onWrite) {
      activeProxy.addWriteListener(options.onWrite)
    }
    return activeProxy
  }

  const globalTarget: (Window & typeof globalThis) | typeof globalThis | null =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? globalThis
        : null

  if (!globalTarget || typeof globalTarget.localStorage === 'undefined') {
    return null
  }

  originalStorage = globalTarget.localStorage
  const proxy = createLocalStorageProxy(originalStorage, {
    ...options,
    onWrite: (event) => {
      options.onWrite?.(event)
      for (const listener of globalListeners) {
        try {
          listener(event)
        } catch (e) {
          console.error('[LocalStorageProxy] Global listener error:', e)
        }
      }
    },
  })

  try {
    Object.defineProperty(globalTarget, 'localStorage', {
      value: proxy,
      configurable: true,
      writable: true,
    })
    activeProxy = proxy
  } catch {
    try {
      const proto = Object.getPrototypeOf(globalTarget)
      if (proto) {
        Object.defineProperty(proto, 'localStorage', {
          get: () => proxy,
          configurable: true,
        })
        activeProxy = proxy
      }
    } catch (protoErr) {
      console.error(
        '[LocalStorageProxy] Failed to install proxy on localStorage:',
        protoErr
      )
      return null
    }
  }

  return activeProxy
}

/**
 * Uninstalls the localStorage proxy, restoring the original storage object.
 */
export function uninstallLocalStorageProxy(): boolean {
  if (!activeProxy || !originalStorage) {
    return false
  }

  const globalTarget: (Window & typeof globalThis) | typeof globalThis | null =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? globalThis
        : null

  if (!globalTarget) return false

  try {
    Object.defineProperty(globalTarget, 'localStorage', {
      value: originalStorage,
      configurable: true,
      writable: true,
    })
  } catch {
    try {
      const proto = Object.getPrototypeOf(globalTarget)
      if (proto) {
        Object.defineProperty(proto, 'localStorage', {
          get: () => originalStorage,
          configurable: true,
        })
      }
    } catch {
      return false
    }
  }

  activeProxy = null
  originalStorage = null
  return true
}

/**
 * Returns whether localStorage is currently proxied.
 */
export function isLocalStorageProxied(): boolean {
  return activeProxy !== null
}

/**
 * Returns the underlying unproxied raw Storage instance if available.
 */
export function getRawLocalStorage(): Storage | null {
  if (originalStorage) return originalStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    return (
      (window.localStorage as ProxiedStorage).rawStorage ?? window.localStorage
    )
  }
  return null
}

/**
 * Subscribes a listener to writing events across any proxy installed via installLocalStorageProxy.
 * Returns an unsubscribe function.
 */
export function addGlobalStorageWriteListener(
  listener: StorageWriteListener
): () => void {
  globalListeners.add(listener)
  return () => {
    globalListeners.delete(listener)
  }
}
