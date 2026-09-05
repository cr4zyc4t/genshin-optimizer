import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CloudSyncStatusChip } from './CloudSyncStatusChip'
import * as useCloudSyncModule from '../hooks/useCloudSync'
import type { SyncRuntimeMetadata } from '@genshin-optimizer/common/gdrive'

describe('CloudSyncStatusChip', () => {
  const baseSyncState: SyncRuntimeMetadata = {
    status: 'IDLE',
    lastSyncTime: 1725537600000,
    remoteFileId: 'file-123',
    remoteModifiedTime: '2026-09-05T12:00:00.000Z',
    lastRemoteHash: 'hash-abc',
    isLocalDirty: false,
    errorMessage: null,
  }

  const mockSession = {
    email: 'traveler@teyvat.org',
    name: 'Traveler',
    accessToken: 'valid-token',
    expiresAt: Date.now() + 3600000,
    scope: 'drive.appdata',
  }

  it('renders null when not authenticated and showUnauthenticated is false', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: null,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'UNAUTHENTICATED' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    const { container } = render(<CloudSyncStatusChip />)
    expect(container.firstChild).toBeNull()
  })

  it('renders unauthenticated chip when showUnauthenticated is true', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: null,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'UNAUTHENTICATED' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(<CloudSyncStatusChip showUnauthenticated />)
    expect(screen.getByText('Not Connected')).toBeDefined()
  })

  it('renders IDLE status when authenticated', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'IDLE' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(<CloudSyncStatusChip />)
    expect(screen.getByText('Synced')).toBeDefined()
  })

  it('renders custom localized labels', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'SYNCING' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(
      <CloudSyncStatusChip
        labels={{
          SYNCING: 'Đang đồng bộ...',
        }}
      />
    )
    expect(screen.getByText('Đang đồng bộ...')).toBeDefined()
  })

  it('triggers onConflictClick when status is CONFLICT', () => {
    const handleConflictClick = vi.fn()
    const handleRegularClick = vi.fn()

    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'CONFLICT' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(
      <CloudSyncStatusChip
        onConflictClick={handleConflictClick}
        onClick={handleRegularClick}
      />
    )

    const chip = screen.getByText('Conflict')
    fireEvent.click(chip)

    expect(handleConflictClick).toHaveBeenCalledTimes(1)
    expect(handleRegularClick).not.toHaveBeenCalled()
  })

  it('triggers onClick when clicked in non-conflict state', () => {
    const handleRegularClick = vi.fn()

    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'IDLE' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(<CloudSyncStatusChip onClick={handleRegularClick} />)

    const chip = screen.getByText('Synced')
    fireEvent.click(chip)

    expect(handleRegularClick).toHaveBeenCalledTimes(1)
  })
})
