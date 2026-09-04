/**
 * Fixed bounds for the user-configurable auto-upload debounce interval.
 *
 * These are intentionally hardcoded (not build-time or runtime configurable) per the
 * cloud-sync design doc (docs/design/cloud-sync.md §16.3) — only the *default* value is
 * build-time configurable per app.
 */
export const DEBOUNCE_MIN_MS = 5_000
export const DEBOUNCE_MAX_MS = 120_000

/** OAuth scope requested for Google Drive access — requires appdata scope to use appDataFolder special space. */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

/** Google Identity Services script, loaded on-demand by {@link GoogleAuth}. */
export const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/** Maximum number of consecutive upload retries before giving up until the next edit/manual sync. */
export const MAX_UPLOAD_RETRIES = 5

/** Base delay for exponential backoff between upload retries. */
export const RETRY_BASE_DELAY_MS = 2_000

export function clampDebounceMs(ms: number): number {
  return Math.min(DEBOUNCE_MAX_MS, Math.max(DEBOUNCE_MIN_MS, ms))
}
