import type {
  GoogleAccountInfo,
  GoogleAuthStatus,
} from '@genshin-optimizer/common/cloud-sync'
import { GoogleAuth } from '@genshin-optimizer/common/cloud-sync'
import { useEffect, useMemo, useState } from 'react'

export interface UseGoogleAuthResult {
  status: GoogleAuthStatus
  account: GoogleAccountInfo | undefined
  signIn: (promptless?: boolean) => Promise<void>
  signOut: () => void
  getAccessToken: () => string | undefined
}

/**
 * React wrapper around {@link GoogleAuth}. Constructs (and recreates, if `clientId` changes)
 * a single `GoogleAuth` instance and mirrors its status into React state.
 */
export function useGoogleAuth(
  clientId: string | undefined
): UseGoogleAuthResult {
  const auth = useMemo(
    () => (clientId ? new GoogleAuth(clientId) : undefined),
    [clientId]
  )
  const [status, setStatus] = useState<GoogleAuthStatus>('signed-out')
  const [account, setAccount] = useState<GoogleAccountInfo | undefined>(
    undefined
  )

  useEffect(() => {
    if (!auth) return
    setStatus(auth.getStatus())
    return auth.onAuthChange((s, acc) => {
      setStatus(s)
      if (s === 'signed-out') setAccount(undefined)
      else if (acc) setAccount(acc)
    })
  }, [auth])

  return useMemo(
    () => ({
      status,
      account,
      signIn: (promptless?: boolean) =>
        auth?.signIn(promptless) ?? Promise.resolve(),
      signOut: () => auth?.signOut(),
      getAccessToken: () => auth?.getAccessToken(),
    }),
    [auth, status, account]
  )
}
