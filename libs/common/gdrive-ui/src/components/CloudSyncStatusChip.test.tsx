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
    expect(
      screen.getByText('settings:cloudSync.status.unauthenticated')
    ).toBeDefined()
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
    expect(screen.getByText('settings:cloudSync.status.idle')).toBeDefined()
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

    const chip = screen.getByText('settings:cloudSync.status.conflict')
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

    const chip = screen.getByText('settings:cloudSync.status.idle')
    fireEvent.click(chip)

    expect(handleRegularClick).toHaveBeenCalledTimes(1)
  })

  it('does not show pending sync status when DEBOUNCING by default (renders idle state)', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'DEBOUNCING' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(<CloudSyncStatusChip />)
    expect(screen.getByText('settings:cloudSync.status.idle')).toBeDefined()
    expect(
      screen.queryByText('settings:cloudSync.status.debouncing')
    ).toBeNull()
  })

  it('shows pending sync status when showPendingSync is true and DEBOUNCING', () => {
    vi.spyOn(useCloudSyncModule, 'useCloudSync').mockReturnValue({
      session: mockSession,
      isAuthLoading: false,
      authError: null,
      login: vi.fn(),
      logout: vi.fn(),
      syncState: { ...baseSyncState, status: 'DEBOUNCING' },
      activeConflict: null,
      syncNow: vi.fn(),
      forceUpload: vi.fn(),
      resolveWithCloud: vi.fn(),
    })

    render(<CloudSyncStatusChip showPendingSync />)
    expect(
      screen.getByText('settings:cloudSync.status.debouncing')
    ).toBeDefined()
  })

  it('renders icon only with no text and accessible aria-label when iconOnly is true', () => {
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

    render(<CloudSyncStatusChip iconOnly />)
    expect(screen.queryByText('settings:cloudSync.status.idle')).toBeNull()
    expect(
      screen.getByLabelText('settings:cloudSync.status.idle')
    ).toBeDefined()
  })
})
