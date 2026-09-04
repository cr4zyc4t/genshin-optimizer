import { SandboxStorage } from '@genshin-optimizer/common/database'
import type { SyncEngineDeps } from '@genshin-optimizer/common/cloud-sync'
import { DriveClient } from '@genshin-optimizer/common/cloud-sync'
import {
  useGoogleAuth,
  useSyncEngine,
} from '@genshin-optimizer/common/cloud-sync-ui'
import type { CloudSyncContextObj } from '@genshin-optimizer/common/cloud-sync-ui'
import { ArtCharDatabase } from '@genshin-optimizer/gi/db'
import { useEffect, useMemo, useRef } from 'react'
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
  const authRef = useRef(auth)
  authRef.current = auth

  const deps = useMemo<SyncEngineDeps>(
    () => ({
      // `auth.getAccessToken` is called lazily via ref inside the closure, so it always uses
      // whatever token `GoogleAuth` holds at upload time without rebuilding SyncEngine.
      driveClient: new DriveClient(() => authRef.current.getAccessToken()),
      fileName: `gi-slot-${database.dbIndex}.json`,
      getMeta: () => database.cloudSyncMeta.get(),
      setMeta: (partial) => database.cloudSyncMeta.set(partial),
      getLocalEdit: () => database.dbMeta.get().lastEdit,
      getPayload: () => JSON.stringify(database.exportGOOD()),
      applySnapshot: (json) => applyCloudSnapshot(database, setDatabase, json),
      getDebounceMs: () => settings.debounceMs,
    }),
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

  // §6: silently re-acquire an expired access token when the engine enters the error state
  // while the user is still "signed in" (i.e. the persisted account info is present but the
  // 1-hour token has lapsed). GIS will re-issue a token without showing a consent screen as
  // long as the browser still holds a valid Google session cookie. If that also fails (offline,
  // session expired), we stay in error state — the user sees the error indicator and can
  // manually click "Sign in" again (spec §6/§12).
  useEffect(() => {
    if (status !== 'error') return
    if (authRef.current.status !== 'signed-in') return
    authRef.current
      .signIn(/* promptless= */ true)
      .then(() => actionsRef.current.syncNow())
      .catch(() => {
        // Silent re-auth failed (session expired / offline) — stay in error state.
        // The user will be prompted to re-authenticate manually.
      })
  }, [status])

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
