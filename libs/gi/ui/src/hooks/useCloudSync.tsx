import { SandboxStorage } from '@genshin-optimizer/common/database'
import type { SyncEngineDeps } from '@genshin-optimizer/common/cloud-sync'
import { DriveClient } from '@genshin-optimizer/common/cloud-sync'
import {
  useGoogleAuth,
  useSyncEngine,
} from '@genshin-optimizer/common/cloud-sync-ui'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { useEffect, useMemo, useRef } from 'react'
import type { CloudSyncContextObj } from '../context/CloudSyncContext'
import { useCloudSyncSettings } from './useCloudSyncSettings'

/**
 * Replaces the local database's content with a downloaded cloud snapshot — a full, clean
 * replace (no merge). Reuses the exact sandbox-clone + importGOOD + swapStorage pipeline that
 * `UploadCard`'s "replace database" action already uses for manually-imported GOOD files
 * (libs/gi/ui/src/components/database/UploadCard.tsx), just with all three merge flags off.
 */
function applyCloudSnapshot(
  database: ArtCharDatabase,
  setDatabase: (index: number, db: ArtCharDatabase) => void,
  json: string
): void {
  const parsed = JSON.parse(json)
  const copyStorage = new SandboxStorage()
  copyStorage.copyFrom(database.storage)
  const importedDatabase = new ArtCharDatabase(database.dbIndex, copyStorage)
  const importResult = importedDatabase.importGOOD(parsed, false, false, false)
  if (!importResult) {
    throw new Error('Downloaded cloud snapshot is not a valid GOOD file')
  }
  importedDatabase.swapStorage(database)
  setDatabase(database.dbIndex - 1, importedDatabase)
  importedDatabase.toExtraLocalDB()
}

/**
 * Composes {@link useGoogleAuth}, {@link useSyncEngine}, and the GI-specific `ArtCharDatabase`
 * glue into the single object exposed via `CloudSyncContext`. Must be called once, at the app
 * root (alongside `SillyContext`/`SnowContext`), so auto-upload keeps running in the background
 * regardless of which page is open — not just while the Settings page/`CloudSyncCard` is mounted.
 */
export function useCloudSync(
  database: ArtCharDatabase,
  setDatabase: (index: number, db: ArtCharDatabase) => void,
  googleClientId: string | undefined,
  defaultDebounceMs: number
): CloudSyncContextObj {
  const { settings, setSettings } = useCloudSyncSettings(defaultDebounceMs)
  const auth = useGoogleAuth(googleClientId)

  const deps = useMemo<SyncEngineDeps>(
    () => ({
      // `auth.getAccessToken` is intentionally called lazily inside the closure (not captured
      // as a snapshot), so it always uses whatever token `GoogleAuth` holds at upload time.
      // auth.getAccessToken must NOT be in the dep array — it's a new function reference on
      // every render of useGoogleAuth and would cause the SyncEngine to be torn down and
      // rebuilt on every auth status change (signing-in → signed-in, etc.), losing pending
      // debounce state. Only structural deps — database identity and debounce interval — belong here.
      driveClient: new DriveClient(() => auth.getAccessToken()),
      fileName: `gi-slot-${database.dbIndex}.json`,
      getMeta: () => database.cloudSyncMeta.get(),
      setMeta: (partial) => database.cloudSyncMeta.set(partial),
      getLocalEdit: () => database.dbMeta.get().lastEdit,
      getPayload: () => JSON.stringify(database.exportGOOD()),
      applySnapshot: (json) => applyCloudSnapshot(database, setDatabase, json),
      getDebounceMs: () => settings.debounceMs,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [database, setDatabase, settings.debounceMs]
  )

  const {
    status,
    meta,
    conflictInfo,
    syncNow,
    resolveConflict,
    notifyLocalEdit,
  } = useSyncEngine(deps)

  // Keep the latest sync actions in a ref so the effect below only needs to depend on
  // `database` (i.e. re-subscribe + re-run startup sync only when the active slot changes,
  // per design doc §8/§9/§16.2), not on every status/meta change these actions close over.
  const actionsRef = useRef({ notifyLocalEdit, syncNow })
  actionsRef.current = { notifyLocalEdit, syncNow }

  useEffect(() => {
    const unfollow = database.dbMeta.follow(() =>
      actionsRef.current.notifyLocalEdit()
    )
    actionsRef.current.syncNow().catch(() => {
      // errors already surfaced via `status` — nothing more to do here
    })
    return unfollow
  }, [database])

  return useMemo<CloudSyncContextObj>(
    () => ({
      configured: !!googleClientId,
      authStatus: auth.status,
      signIn: () => auth.signIn(),
      // M1 fix: clear persisted account info on sign-out so stale email doesn't survive reload.
      signOut: () => {
        auth.signOut()
        setSettings({ account: undefined })
      },
      status,
      meta,
      conflictInfo,
      setEnabled: (enabled) => database.cloudSyncMeta.set({ enabled }),
      syncNow,
      resolveConflict,
      settings,
      setSettings,
    }),
    [
      googleClientId,
      auth,
      status,
      meta,
      conflictInfo,
      database,
      syncNow,
      resolveConflict,
      settings,
      setSettings,
    ]
  )
}
