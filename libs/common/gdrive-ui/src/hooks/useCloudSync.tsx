import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import {
  CloudSyncManager,
  GoogleDriveApiClient,
  type CloudAccountSession,
  type ConflictComparison,
  type MultiSlotDataAdapter,
  type SyncRuntimeMetadata,
} from '@genshin-optimizer/common/gdrive'
import { useCloudAuth } from './useCloudAuth'

export interface UseCloudSyncOptions {
  clientId: string
  adapter: MultiSlotDataAdapter
  debounceMs?: number
  syncFileName?: string
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
  const { clientId, adapter, debounceMs, syncFileName } = options

  const auth = useCloudAuth(clientId)
  const driveClient = useMemo(() => new GoogleDriveApiClient(), [])

  const syncManager = useMemo(() => {
    console.log('[CloudSync] Hook: creating CloudSyncManager instance', {
      clientId,
      appId: adapter.appId,
    })
    const mgr = new CloudSyncManager(auth.client, driveClient, {
      debounceMs,
      syncFileName,
    })
    mgr.setAdapter(adapter)
    return mgr
  }, [auth.client, driveClient, adapter, debounceMs, syncFileName, clientId])

  const [syncState, setSyncState] = useState<SyncRuntimeMetadata>(() =>
    syncManager.getState()
  )
  const [activeConflict, setActiveConflict] =
    useState<ConflictComparison | null>(() => syncManager.getActiveConflict())

  useEffect(() => {
    syncManager.setAdapter(adapter)
  }, [syncManager, adapter])

  useEffect(() => {
    console.log(
      '[CloudSync] Hook: starting CloudSyncManager (session:',
      auth.session?.email ?? 'none',
      ')'
    )
    const unsubState = syncManager.subscribeState(setSyncState)
    const unsubConflict = syncManager.subscribeConflict(setActiveConflict)

    syncManager.start()

    if (auth.session) {
      console.log(
        '[CloudSync] Hook: active session detected on mount/auth change -> triggering initial focus check'
      )
      syncManager.handleWindowFocus().catch(console.error)
    }

    return () => {
      console.log('[CloudSync] Hook: cleaning up CloudSyncManager listeners')
      unsubState()
      unsubConflict()
      syncManager.stop()
    }
  }, [syncManager, auth.session])

  const syncNow = useCallback(async () => {
    console.log('[CloudSync] Trigger: manual "Sync Now" button clicked')
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
  syncFileName,
}: {
  children: ReactNode
  clientId: string
  adapter: MultiSlotDataAdapter
  debounceMs?: number
  syncFileName?: string
}) {
  const value = useCloudSyncInstance({
    clientId,
    adapter,
    debounceMs,
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
