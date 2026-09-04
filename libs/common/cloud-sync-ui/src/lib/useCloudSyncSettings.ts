import type { CloudSyncSettings } from '@genshin-optimizer/common/cloud-sync'
import { clampDebounceMs } from '@genshin-optimizer/common/cloud-sync'
import { useCallback, useEffect, useMemo, useState } from 'react'

// NOTE: Stored in plain localStorage (not DBStorage) — deliberate deviation from design doc §6.
//
// The spec says "persisted in DBStorage (per game, global — not per slot)", but DBStorage in
// this codebase is per-slot (one database class per dbIndex). Storing truly global settings
// there would require either picking an arbitrary slot or introducing a new cross-slot storage
// abstraction that doesn't exist. Using plain localStorage matches the useSnow/useSilly pattern
// already established for global display preferences in this app.
//
// Trade-off: a per-slot DB reset (or factory reset of one slot) will NOT clear the account
// display info, so the "Signed in as user@gmail.com" label could transiently appear stale
// after a reset. This is cosmetic only — the GIS access token is always in-memory, so auth
// state (and therefore the ability to actually sync) is always correct after a page reload.
// A full Sign-out (which calls setSettings({ account: undefined })) or clearing browser
// site data will clear it completely.
//
// Each game passes its own `storageKey` to namespace the setting:
//   GI  → 'gi_cloudSyncSettings'
//   SR  → 'sr_cloudSyncSettings'
//   ZZZ → 'zzz_cloudSyncSettings'

function readSettings(
  storageKey: string,
  defaultDebounceMs: number
): CloudSyncSettings {
  const raw = localStorage.getItem(storageKey)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<CloudSyncSettings>
      return {
        // Spread conditionally so we never write `account: undefined` into an
        // exactOptionalPropertyTypes-strict object (undefined !== absent key).
        ...(parsed.account !== undefined ? { account: parsed.account } : {}),
        debounceMs: clampDebounceMs(parsed.debounceMs ?? defaultDebounceMs),
      }
    } catch {
      // fall through to default below
    }
  }
  return { debounceMs: clampDebounceMs(defaultDebounceMs) }
}

/**
 * Global (not per-slot) cloud sync settings — account display info + the user-configurable
 * debounce value (design doc §7/§11). Follows the same plain-`localStorage` + hook pattern as
 * `useSnow`/`useSilly`. See the NOTE above on why localStorage is used rather than DBStorage.
 *
 * @param storageKey - Game-specific localStorage key, e.g. `'gi_cloudSyncSettings'`.
 * @param defaultDebounceMs - Build-time default debounce interval (§6.1).
 */
export function useCloudSyncSettings(
  storageKey: string,
  defaultDebounceMs: number
): {
  settings: CloudSyncSettings
  setSettings: (settings: Partial<CloudSyncSettings>) => void
} {
  const [settings, setSettingsState] = useState<CloudSyncSettings>(() =>
    readSettings(storageKey, defaultDebounceMs)
  )

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  }, [storageKey, settings])

  const setSettings = useCallback(
    (partial: Partial<CloudSyncSettings>) =>
      setSettingsState((prev) => ({
        ...prev,
        ...partial,
        debounceMs: clampDebounceMs(partial.debounceMs ?? prev.debounceMs),
      })),
    []
  )

  return useMemo(() => ({ settings, setSettings }), [settings, setSettings])
}
