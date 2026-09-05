import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GoogleIdentityClient } from './GoogleIdentityClient'
import type { CloudAccountSession } from './types'

describe('GoogleIdentityClient', () => {
  let client: GoogleIdentityClient

  const mockSession: CloudAccountSession = {
    sub: '12345',
    email: 'traveler@teyvat.org',
    name: 'Lumine',
    picture: 'https://example.com/avatar.png',
    accessToken: 'test-token-123',
    expiresAt: Date.now() + 3600 * 1000,
    scope: 'https://www.googleapis.com/auth/drive.appdata',
  }

  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    client = new GoogleIdentityClient({
      clientId: 'test-client-id.apps.googleusercontent.com',
    })
  })

  it('loads and saves session from localStorage', () => {
    expect(client.loadCachedSession()).toBeNull()

    client.saveSession(mockSession)
    const cached = client.loadCachedSession()
    expect(cached).not.toBeNull()
    expect(cached?.email).toBe('traveler@teyvat.org')
    expect(cached?.accessToken).toBe('test-token-123')
  })

  it('clears session on logout', async () => {
    client.saveSession(mockSession)
    expect(client.loadCachedSession()).not.toBeNull()

    await client.logout()
    expect(client.loadCachedSession()).toBeNull()
  })

  it('identifies expired sessions correctly', () => {
    const expiredSession: CloudAccountSession = {
      ...mockSession,
      expiresAt: Date.now() - 1000,
    }
    expect(client.isSessionExpired(expiredSession)).toBe(true)
    expect(client.isSessionExpired(mockSession)).toBe(false)
  })

  it('identifies sessions needing renewal within buffer window', () => {
    // 3 minutes left (within default 5m buffer)
    const nearExpirySession: CloudAccountSession = {
      ...mockSession,
      expiresAt: Date.now() + 3 * 60 * 1000,
    }
    expect(client.shouldRenewSession(nearExpirySession)).toBe(true)

    // 45 minutes left
    const freshSession: CloudAccountSession = {
      ...mockSession,
      expiresAt: Date.now() + 45 * 60 * 1000,
    }
    expect(client.shouldRenewSession(freshSession)).toBe(false)
  })
})
