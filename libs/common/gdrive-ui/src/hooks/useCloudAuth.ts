import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  GoogleIdentityClient,
  type CloudAccountSession,
} from '@genshin-optimizer/common/gdrive'

export interface UseCloudAuthReturn {
  session: CloudAccountSession | null
  isLoading: boolean
  error: string | null
  client: GoogleIdentityClient
  login: () => Promise<CloudAccountSession | null>
  logout: () => Promise<void>
  refreshSession: () => Promise<CloudAccountSession | null>
}

export function useCloudAuth(clientId: string): UseCloudAuthReturn {
  const client = useMemo(
    () => new GoogleIdentityClient({ clientId }),
    [clientId]
  )

  const [session, setSession] = useState<CloudAccountSession | null>(() => {
    return client.loadCachedSession()
  })
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // On mount, if cached session is near expiry or expired, attempt silent refresh
  useEffect(() => {
    const cached = client.loadCachedSession()
    if (!cached) return

    if (client.shouldRenewSession(cached)) {
      client.silentRefresh().then((refreshed) => {
        if (refreshed) {
          setSession(refreshed)
        }
      })
    }
  }, [client])

  const login = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const newSession = await client.requestLogin()
      setSession(newSession)
      return newSession
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to log in with Google Drive'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await client.logout()
      setSession(null)
      setError(null)
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const refreshSession = useCallback(async () => {
    try {
      const refreshed = await client.silentRefresh()
      if (refreshed) {
        setSession(refreshed)
      }
      return refreshed
    } catch {
      return null
    }
  }, [client])

  return {
    session,
    isLoading,
    error,
    client,
    login,
    logout,
    refreshSession,
  }
}
