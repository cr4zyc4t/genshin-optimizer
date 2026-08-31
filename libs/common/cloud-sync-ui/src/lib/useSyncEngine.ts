import type {
  CloudSyncMeta,
  ConflictInfo,
  SyncEngineDeps,
  SyncResult,
  SyncStatus,
} from '@genshin-optimizer/common/cloud-sync'
import { SyncEngine } from '@genshin-optimizer/common/cloud-sync'
import { useEffect, useMemo, useState } from 'react'

export interface UseSyncEngineResult {
  status: SyncStatus
  meta: CloudSyncMeta | undefined
  /** Populated only while `status === 'conflict'` — the local vs. cloud metadata to display. */
  conflictInfo: ConflictInfo | undefined
  syncNow: () => Promise<SyncResult>
  resolveConflict: (choice: 'keepLocal' | 'keepCloud') => Promise<void>
  notifyLocalEdit: () => void
  flushPendingUpload: () => void
}

/**
 * React wrapper around {@link SyncEngine}. `deps` should be memoized by the caller (e.g. keyed
 * on the active database slot) — a new `deps` reference recreates (and disposes the old)
 * engine, since a `SyncEngine` is only ever meant to track one slot at a time (design doc §16.2).
 */
export function useSyncEngine(
  deps: SyncEngineDeps | undefined
): UseSyncEngineResult {
  const engine = useMemo(
    () => (deps ? new SyncEngine(deps) : undefined),
    [deps]
  )
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [meta, setMeta] = useState<CloudSyncMeta | undefined>(undefined)
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | undefined>(
    undefined
  )

  useEffect(() => {
    if (!engine) return
    setStatus(engine.getStatus())
    setMeta(deps?.getMeta())
    setConflictInfo(engine.getConflictInfo())
    const unsub = engine.onStatusChange((s, m) => {
      setStatus(s)
      setMeta(m)
      setConflictInfo(s === 'conflict' ? engine.getConflictInfo() : undefined)
    })
    return () => {
      unsub()
      // Best-effort flush of a pending debounced upload before this engine goes away —
      // e.g. when the caller switches the active slot (design doc §8/§16.2).
      engine.flushPendingUpload()
      engine.dispose()
    }
  }, [engine, deps])

  return useMemo(
    () => ({
      status,
      meta,
      conflictInfo,
      syncNow: () => engine?.syncNow() ?? Promise.resolve('noop' as const),
      resolveConflict: (choice: 'keepLocal' | 'keepCloud') =>
        engine?.resolveConflict(choice) ?? Promise.resolve(),
      notifyLocalEdit: () => engine?.notifyLocalEdit(),
      flushPendingUpload: () => engine?.flushPendingUpload(),
    }),
    [engine, status, meta, conflictInfo]
  )
}
