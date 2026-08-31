import type {
  CloudSyncMeta,
  CloudSyncSettings,
  ConflictInfo,
  SyncResult,
  SyncStatus,
} from '@genshin-optimizer/common/cloud-sync'
import type { GoogleAuthStatus } from '@genshin-optimizer/common/cloud-sync'
import { createContext } from 'react'

export type CloudSyncContextObj = {
  /** Whether a Google OAuth Client ID was provided at build time — if false, the feature is hidden. */
  configured: boolean
  authStatus: GoogleAuthStatus
  signIn: () => Promise<void>
  signOut: () => void
  /** Sync state for the currently *active* slot only (design doc §16.2). */
  status: SyncStatus
  meta: CloudSyncMeta | undefined
  conflictInfo: ConflictInfo | undefined
  setEnabled: (enabled: boolean) => void
  syncNow: () => Promise<SyncResult>
  resolveConflict: (choice: 'keepLocal' | 'keepCloud') => Promise<void>
  settings: CloudSyncSettings
  setSettings: (settings: Partial<CloudSyncSettings>) => void
}

export const CloudSyncContext = createContext<CloudSyncContextObj>({
  configured: false,
  authStatus: 'signed-out',
  signIn: () => Promise.resolve(),
  signOut: () => {},
  status: 'disabled',
  meta: undefined,
  conflictInfo: undefined,
  setEnabled: () => {},
  syncNow: () => Promise.resolve('noop'),
  resolveConflict: () => Promise.resolve(),
  settings: { debounceMs: 15_000 },
  setSettings: () => {},
})
