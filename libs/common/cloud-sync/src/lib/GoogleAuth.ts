import { DRIVE_FILE_SCOPE, GIS_SCRIPT_SRC } from './constants'
import type {
  GoogleTokenClient,
  GoogleTokenClientError,
  GoogleTokenResponse,
} from './google-gsi'

export type GoogleAuthStatus =
  | 'signed-out'
  | 'signing-in'
  | 'signed-in'
  | 'error'

export interface GoogleAccountInfo {
  email: string
  avatarUrl?: string
}

export type GoogleAuthListener = (
  status: GoogleAuthStatus,
  account?: GoogleAccountInfo
) => void

/**
 * Wraps the Google Identity Services (GIS) token client for the `drive.file` scope.
 *
 * - The GIS script is loaded lazily on first use (no `index.html` changes needed).
 * - The access token is kept **in memory only** — never persisted to storage (design doc §6/§13).
 * - Only the `drive.file` scope is ever requested (least-privilege).
 */
export class GoogleAuth {
  private readonly clientId: string
  private tokenClient: GoogleTokenClient | undefined
  private accessToken: string | undefined
  private status: GoogleAuthStatus = 'signed-out'
  private readonly listeners = new Set<GoogleAuthListener>()

  constructor(clientId: string) {
    this.clientId = clientId
  }

  getStatus(): GoogleAuthStatus {
    return this.status
  }

  getAccessToken(): string | undefined {
    return this.accessToken
  }

  onAuthChange(listener: GoogleAuthListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private setStatus(status: GoogleAuthStatus, account?: GoogleAccountInfo) {
    this.status = status
    this.listeners.forEach((listener) => listener(status, account))
  }

  private async ensureScriptLoaded(): Promise<void> {
    if (window.google?.accounts?.oauth2) return
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_SCRIPT_SRC}"]`
      )
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () =>
          reject(new Error('Failed to load Google Identity Services script'))
        )
        return
      }
      const script = document.createElement('script')
      script.src = GIS_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () =>
        reject(new Error('Failed to load Google Identity Services script'))
      document.head.appendChild(script)
    })
  }

  private async ensureTokenClient(): Promise<GoogleTokenClient> {
    await this.ensureScriptLoaded()
    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services failed to initialize')
    }
    if (!this.tokenClient) {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_FILE_SCOPE,
        callback: () => {
          // overridden per-request in signIn()
        },
      })
    }
    return this.tokenClient
  }

  /**
   * Requests an access token. Pass `promptless: true` for a silent re-auth attempt (no
   * visible consent screen) when a valid Google session cookie is expected to still exist.
   */
  async signIn(promptless = false): Promise<void> {
    const tokenClient = await this.ensureTokenClient()
    this.setStatus('signing-in')
    return new Promise<void>((resolve, reject) => {
      tokenClient.callback = (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token) {
          this.setStatus('error')
          reject(
            new Error(response.error_description ?? 'Google sign-in failed')
          )
          return
        }
        this.accessToken = response.access_token
        this.setStatus('signed-in')
        resolve()
      }
      tokenClient.error_callback = (error: GoogleTokenClientError) => {
        this.setStatus(promptless ? 'signed-out' : 'error')
        reject(new Error(error.message ?? 'Google sign-in failed'))
      }
      tokenClient.requestAccessToken({ prompt: promptless ? '' : 'consent' })
    })
  }

  signOut(): void {
    if (this.accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(this.accessToken, () => {
        // best-effort — token is discarded locally regardless of server response
      })
    }
    this.accessToken = undefined
    this.setStatus('signed-out')
  }
}
