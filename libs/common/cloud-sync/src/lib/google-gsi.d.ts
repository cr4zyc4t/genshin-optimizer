// Minimal ambient types for the Google Identity Services (GIS) token client — only the
// surface used by GoogleAuth.ts. There is no official `@types` package for this script.

export interface GoogleTokenResponse {
  access_token: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

export interface GoogleTokenClientError {
  type: string
  message?: string
}

export interface GoogleTokenClient {
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: GoogleTokenClientError) => void
  requestAccessToken(overrideConfig?: { prompt?: string }): void
}

export interface GoogleTokenClientConfig {
  client_id: string
  scope: string
  callback: (response: GoogleTokenResponse) => void
  error_callback?: (error: GoogleTokenClientError) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: GoogleTokenClientConfig): GoogleTokenClient
          revoke(accessToken: string, callback: () => void): void
        }
      }
    }
  }
}
