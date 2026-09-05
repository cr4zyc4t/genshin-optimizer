import type { CloudAccountSession, GISConfig } from './types'

export const AUTH_STORAGE_KEY = 'gdrive_auth_session'
export const DEFAULT_SCOPE =
  'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'

// Buffer window for proactively refreshing token (5 minutes in ms)
export const RENEWAL_BUFFER_MS = 5 * 60 * 1000

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              error?: string
              expires_in?: number
              scope?: string
            }) => void
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void
          }
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export class GoogleIdentityClient {
  private config: GISConfig
  private tokenClient: {
    requestAccessToken: (overrideConfig?: { prompt?: string }) => void
  } | null = null
  private initPromise: Promise<void> | null = null

  constructor(config: GISConfig) {
    this.config = {
      clientId: config.clientId,
      scope: config.scope ?? DEFAULT_SCOPE,
    }
  }

  public updateClientId(clientId: string) {
    if (this.config.clientId !== clientId) {
      this.config.clientId = clientId
      this.tokenClient = null
    }
  }

  public getClientId(): string {
    return this.config.clientId
  }

  /**
   * Loads Google Identity Services (GIS) client script dynamically if needed.
   */
  public async init(): Promise<void> {
    if (this.tokenClient) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve()
        return
      }

      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }

      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      )
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', (e) => reject(e), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = (e) =>
        reject(new Error(`Failed to load Google Identity Services: ${e}`))
      document.head.appendChild(script)
    })

    return this.initPromise
  }

  /**
   * Request user login via Google Identity Services token client popup.
   */
  public async requestLogin(): Promise<CloudAccountSession> {
    await this.init()

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services SDK is not available.')
    }

    if (!this.config.clientId) {
      throw new Error('Google OAuth Client ID is not configured.')
    }

    return new Promise<CloudAccountSession>((resolve, reject) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: this.config.clientId,
          scope: this.config.scope ?? DEFAULT_SCOPE,
          callback: async (tokenResponse) => {
            if (tokenResponse.error || !tokenResponse.access_token) {
              reject(
                new Error(
                  tokenResponse.error || 'Login was cancelled or failed.'
                )
              )
              return
            }

            try {
              const profile = await this.fetchUserProfile(
                tokenResponse.access_token
              )
              const expiresInMs = (tokenResponse.expires_in ?? 3599) * 1000
              const session: CloudAccountSession = {
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
                accessToken: tokenResponse.access_token,
                expiresAt: Date.now() + expiresInMs,
                scope:
                  tokenResponse.scope ?? this.config.scope ?? DEFAULT_SCOPE,
              }
              this.saveSession(session)
              resolve(session)
            } catch (err) {
              reject(err)
            }
          },
        })

        this.tokenClient = tokenClient
        tokenClient.requestAccessToken()
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Attempts non-interactive silent token refresh if session is near or past expiration.
   */
  public async silentRefresh(): Promise<CloudAccountSession | null> {
    const currentSession = this.loadCachedSession()
    if (!currentSession) return null

    await this.init()

    if (!window.google?.accounts?.oauth2 || !this.config.clientId) {
      return null
    }

    return new Promise<CloudAccountSession | null>((resolve) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: this.config.clientId,
          scope: this.config.scope ?? DEFAULT_SCOPE,
          callback: (tokenResponse) => {
            if (tokenResponse.error || !tokenResponse.access_token) {
              // Silent refresh could not proceed (interaction required or session ended)
              resolve(null)
              return
            }

            const expiresInMs = (tokenResponse.expires_in ?? 3599) * 1000
            const updatedSession: CloudAccountSession = {
              ...currentSession,
              accessToken: tokenResponse.access_token,
              expiresAt: Date.now() + expiresInMs,
              scope: tokenResponse.scope ?? currentSession.scope,
            }
            this.saveSession(updatedSession)
            resolve(updatedSession)
          },
        })

        this.tokenClient = tokenClient
        tokenClient.requestAccessToken({ prompt: '' })
      } catch {
        resolve(null)
      }
    })
  }

  /**
   * Fetches user profile from Google OAuth2 userinfo endpoint.
   */
  public async fetchUserProfile(accessToken: string): Promise<{
    email: string
    name: string
    picture?: string
  }> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (!res.ok) {
      throw new Error(
        `Failed to fetch user profile: ${res.status} ${res.statusText}`
      )
    }
    const data = await res.json()
    return {
      email: data.email ?? 'Unknown Email',
      name: data.name ?? 'Google User',
      picture: data.picture,
    }
  }

  /**
   * Loads cached session from localStorage.
   */
  public loadCachedSession(): CloudAccountSession | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as CloudAccountSession
    } catch {
      return null
    }
  }

  /**
   * Saves active session to localStorage.
   */
  public saveSession(session: CloudAccountSession): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    } catch (e) {
      console.error('Failed to save cloud auth session to localStorage', e)
    }
  }

  /**
   * Clears session from localStorage and optionally revokes the token.
   */
  public async logout(): Promise<void> {
    const session = this.loadCachedSession()
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }

    if (session?.accessToken && window?.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(session.accessToken)
      } catch (e) {
        console.warn('Failed to revoke Google OAuth token', e)
      }
    }
  }

  /**
   * Checks whether session is already past its expiration timestamp.
   */
  public isSessionExpired(session: CloudAccountSession): boolean {
    return Date.now() >= session.expiresAt
  }

  /**
   * Checks whether session is expired or within the 5-minute renewal buffer.
   */
  public shouldRenewSession(session: CloudAccountSession): boolean {
    return Date.now() >= session.expiresAt - RENEWAL_BUFFER_MS
  }
}
