/**
 * Build-time cloud-sync configuration for the GI (`frontend`) app — design doc §16.3/§16.4.
 *
 * - `GOOGLE_CLIENT_ID` is the public (non-secret) Google OAuth Client ID, registered by the
 *   repo owner in Google Cloud Console for this app's production origin(s) + `localhost` for
 *   dev. Supplied via `NX_GOOGLE_CLIENT_ID` in `apps/frontend/.env` (same `NX_`-prefixed
 *   `process.env` convention already used for `NX_GA_TRACKINGID`/`NX_URL_*` in this app — see
 *   `apps/frontend/src/main.tsx`). If unset, the Cloud Sync card hides itself entirely
 *   (`CloudSyncContext.configured === false`).
 * - `DEBOUNCE_DEFAULT_MS` is the default auto-upload debounce interval (seconds shown in the
 *   UI). Only the default is build-time configurable — the min/max bounds are fixed in
 *   `@genshin-optimizer/common/cloud-sync`'s `DEBOUNCE_MIN_MS`/`DEBOUNCE_MAX_MS` constants.
 */
export const GOOGLE_CLIENT_ID: string | undefined =
  process.env.NX_GOOGLE_CLIENT_ID || undefined

export const DEBOUNCE_DEFAULT_MS = 15_000
