import type { CloudSyncSettings } from '@genshin-optimizer/common/cloud-sync'
import { useCloudSyncSettings as useCloudSyncSettingsCommon } from '@genshin-optimizer/common/cloud-sync-ui'

/** GI-specific wrapper — passes the GI storage key to the shared hook. */
export function useCloudSyncSettings(defaultDebounceMs: number): {
  settings: CloudSyncSettings
  setSettings: (settings: Partial<CloudSyncSettings>) => void
} {
  return useCloudSyncSettingsCommon('gi_cloudSyncSettings', defaultDebounceMs)
}
