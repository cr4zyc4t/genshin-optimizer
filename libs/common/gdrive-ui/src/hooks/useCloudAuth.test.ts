import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCloudAuth } from './useCloudAuth'
import {
  GoogleIdentityClient,
  type CloudAccountSession,
  AUTH_STORAGE_KEY,
} from '@genshin-optimizer/common/gdrive'

describe('useCloudAuth', () => {
  const mockSession: CloudAccountSession = {
    email: 'traveler@teyvat.org',
    name: 'Lumine',
    accessToken: 'test-token',
    expiresAt: Date.now() + 3600 * 1000,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('initializes with cached session if present in localStorage', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession))

    const { result } = renderHook(() => useCloudAuth('test-client-id'))

    expect(result.current.session).not.toBeNull()
    expect(result.current.session?.email).toBe('traveler@teyvat.org')
  })

  it('clears session on logout', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mockSession))

    const { result } = renderHook(() => useCloudAuth('test-client-id'))
    expect(result.current.session).not.toBeNull()

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.session).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('handles login success and updates session state', async () => {
    vi.spyOn(GoogleIdentityClient.prototype, 'requestLogin').mockResolvedValue(
      mockSession
    )

    const { result } = renderHook(() => useCloudAuth('test-client-id'))
    expect(result.current.session).toBeNull()

    await act(async () => {
      await result.current.login()
    })

    expect(result.current.session).not.toBeNull()
    expect(result.current.session?.name).toBe('Lumine')
    expect(result.current.error).toBeNull()
  })

  it('records error message if login fails', async () => {
    vi.spyOn(GoogleIdentityClient.prototype, 'requestLogin').mockRejectedValue(
      new Error('Popup closed by user')
    )

    const { result } = renderHook(() => useCloudAuth('test-client-id'))

    await act(async () => {
      await result.current.login()
    })

    expect(result.current.session).toBeNull()
    expect(result.current.error).toBe('Popup closed by user')
  })
})
