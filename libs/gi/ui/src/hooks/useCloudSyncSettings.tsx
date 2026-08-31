import type { CloudSyncSettings } from '@genshin-optimizer/common/cloud-sync'
import { clampDebounceMs } from '@genshin-optimizer/common/cloud-sync'
import { useCallback, useEffect, useMemo, useState } from 'react'

const lsKey = 'gi_cloudSyncSettings'

function readSettings(defaultDebounceMs: number): CloudSyncSettings {
  const raw = localStorage.getItem(lsKey)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<CloudSyncSettings>
      return {
        account: parsed.account,
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
 * `useSnow`/`useSilly`.
 */
export function useCloudSyncSettings(defaultDebounceMs: number): {
  settings: CloudSyncSettings
  setSettings: (settings: Partial<CloudSyncSettings>) => void
} {
  const [settings, setSettingsState] = useState<CloudSyncSettings>(() =>
    readSettings(defaultDebounceMs)
  )

  useEffect(() => {
    localStorage.setItem(lsKey, JSON.stringify(settings))
  }, [settings])

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
