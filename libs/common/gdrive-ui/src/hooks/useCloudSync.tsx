import {
  type CloudAccountSession,
  CloudSyncManager,
  type ConflictComparison,
  DEFAULT_SYNC_DEBOUNCE_MS,
  DEFAULT_SYNC_MAX_WAIT_MS,
  GoogleDriveApiClient,
  type MultiSlotDataAdapter,
  type SyncRuntimeMetadata,
} from '@genshin-optimizer/common/gdrive'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useCloudAuth } from './useCloudAuth'

export { DEFAULT_SYNC_DEBOUNCE_MS, DEFAULT_SYNC_MAX_WAIT_MS }

export interface UseCloudSyncOptions {
  clientId: string
  adapter: MultiSlotDataAdapter
  debounceMs?: number | undefined
  maxWaitMs?: number | undefined
  syncFileName?: string | undefined
}

export interface UseCloudSyncReturn {
  session: ReturnType<typeof useCloudAuth>['session']
  isAuthLoading: boolean
  authError: string | null
  login: () => Promise<CloudAccountSession | null>
  logout: () => Promise<void>
  syncState: SyncRuntimeMetadata
  activeConflict: ConflictComparison | null
  syncNow: () => Promise<void>
  forceUpload: () => Promise<void>
  resolveWithCloud: () => Promise<void>
}

export const CloudSyncContext = createContext<UseCloudSyncReturn | null>(null)

export function useCloudSyncInstance(
  options: UseCloudSyncOptions
): UseCloudSyncReturn {
  const { clientId, adapter, debounceMs, maxWaitMs, syncFileName } = options

  const auth = useCloudAuth(clientId)
  const driveClient = useMemo(() => new GoogleDriveApiClient(), [])

  // NOTE: `adapter` is intentionally excluded from useMemo deps.
  // The manager is long-lived; adapter updates are handled imperatively via
  // setAdapter() in the useEffect below, so we never need to recreate it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: above
  const syncManager = useMemo(() => {
    const mgr = new CloudSyncManager(auth.client, driveClient, {
      debounceMs,
      maxWaitMs,
      syncFileName,
    })
    mgr.setAdapter(adapter)
    return mgr
  }, [auth.client, driveClient, debounceMs, maxWaitMs, syncFileName])

  const [syncState, setSyncState] = useState<SyncRuntimeMetadata>(() =>
    syncManager.getState()
  )
  const [activeConflict, setActiveConflict] =
    useState<ConflictComparison | null>(() => syncManager.getActiveConflict())

  useEffect(() => {
    syncManager.setAdapter(adapter)
  }, [syncManager, adapter])

  useEffect(() => {
    const unsubState = syncManager.subscribeState(setSyncState)
    const unsubConflict = syncManager.subscribeConflict(setActiveConflict)

    syncManager.start()

    if (auth.session) {
      syncManager.handleWindowFocus().catch(console.error)
    }

    return () => {
      unsubState()
      unsubConflict()
      syncManager.stop()
    }
  }, [syncManager, auth.session])

  const syncNow = useCallback(async () => {
    await syncManager.sync()
  }, [syncManager])

  const forceUpload = useCallback(async () => {
    await syncManager.forceUpload()
  }, [syncManager])

  const resolveWithCloud = useCallback(async () => {
    await syncManager.resolveWithCloud()
  }, [syncManager])

  const handleLogout = useCallback(async () => {
    syncManager.stop()
    await auth.logout()
  }, [syncManager, auth])

  return {
    session: auth.session,
    isAuthLoading: auth.isLoading,
    authError: auth.error,
    login: auth.login,
    logout: handleLogout,
    syncState,
    activeConflict,
    syncNow,
    forceUpload,
    resolveWithCloud,
  }
}

export function CloudSyncProvider({
  children,
  clientId,
  adapter,
  debounceMs,
  maxWaitMs,
  syncFileName,
}: {
  children: ReactNode
  clientId: string
  adapter: MultiSlotDataAdapter
  debounceMs?: number | undefined
  maxWaitMs?: number | undefined
  syncFileName?: string | undefined
}) {
  const value = useCloudSyncInstance({
    clientId,
    adapter,
    debounceMs,
    maxWaitMs,
    syncFileName,
  })

  return (
    <CloudSyncContext.Provider value={value}>
      {children}
    </CloudSyncContext.Provider>
  )
}

export function useCloudSync(): UseCloudSyncReturn {
  const context = useContext(CloudSyncContext)
  if (!context) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider')
  }
  return context
}
