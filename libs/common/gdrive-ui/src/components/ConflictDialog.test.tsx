import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictDialog } from './ConflictDialog'
import type { ConflictComparison } from '@genshin-optimizer/common/gdrive'

describe('ConflictDialog', () => {
  const mockConflict: ConflictComparison = {
    local: {
      timestamp: 1725537600000,
      byteSize: 154000,
      slots: {
        1: {
          name: 'Main',
          lastEdit: 1725537600000,
          characterCount: 40,
          artifactCount: 800,
          weaponCount: 90,
        },
        2: {
          name: 'Alt',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        3: {
          name: 'Slot 3',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        4: {
          name: 'Slot 4',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
      },
    },
    cloud: {
      timestamp: 1725530000000,
      byteSize: 25000,
      slots: {
        1: {
          name: 'Main',
          lastEdit: 1725530000000,
          characterCount: 5,
          artifactCount: 20,
          weaponCount: 10,
        },
        2: {
          name: 'Alt',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        3: {
          name: 'Slot 3',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
        4: {
          name: 'Slot 4',
          lastEdit: 0,
          characterCount: 0,
          artifactCount: 0,
          weaponCount: 0,
        },
      },
    },
    hasSevereDisparity: true,
    disparityWarningText:
      'Caution: One version has substantially less data than the other.',
  }

  it('renders comparison details and severity warning when open', () => {
    render(
      <ConflictDialog
        open={true}
        conflictData={mockConflict}
        onKeepLocal={vi.fn()}
        onUseCloud={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('settings:conflictDialog.title')).toBeDefined()
    expect(
      screen.getByText('settings:conflictDialog.disparityAlert')
    ).toBeDefined()
    expect(screen.getByText('settings:conflictDialog.localTitle')).toBeDefined()
    expect(screen.getByText('settings:conflictDialog.cloudTitle')).toBeDefined()
    expect(screen.getByText('NEW')).toBeDefined()
    expect(screen.getByText('OLD')).toBeDefined()
  })

  it('renders NEW for newer version and OLD for older version', () => {
    // Cloud is newer
    const cloudNewerConflict: ConflictComparison = {
      ...mockConflict,
      local: { ...mockConflict.local, timestamp: 1000 },
      cloud: { ...mockConflict.cloud, timestamp: 2000 },
    }
    render(
      <ConflictDialog
        open={true}
        conflictData={cloudNewerConflict}
        onKeepLocal={vi.fn()}
        onUseCloud={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('NEW')).toBeDefined()
    expect(screen.getByText('OLD')).toBeDefined()
  })

  it('invokes onKeepLocal when clicking Keep Local Data', () => {
    const onKeepLocal = vi.fn()
    render(
      <ConflictDialog
        open={true}
        conflictData={mockConflict}
        onKeepLocal={onKeepLocal}
        onUseCloud={vi.fn()}
        onClose={vi.fn()}
      />
    )

    const keepLocalBtn = screen.getByRole('button', {
      name: 'settings:conflictDialog.keepLocal',
    })
    fireEvent.click(keepLocalBtn)

    expect(onKeepLocal).toHaveBeenCalled()
  })

  it('invokes onUseCloud when clicking Use Cloud Data', () => {
    const onUseCloud = vi.fn()
    render(
      <ConflictDialog
        open={true}
        conflictData={mockConflict}
        onKeepLocal={vi.fn()}
        onUseCloud={onUseCloud}
        onClose={vi.fn()}
      />
    )

    const useCloudBtn = screen.getByRole('button', {
      name: 'settings:conflictDialog.useCloud',
    })
    fireEvent.click(useCloudBtn)

    expect(onUseCloud).toHaveBeenCalled()
  })

  it('invokes onClose when clicking Cancel button', () => {
    const onClose = vi.fn()
    render(
      <ConflictDialog
        open={true}
        conflictData={mockConflict}
        onKeepLocal={vi.fn()}
        onUseCloud={vi.fn()}
        onClose={onClose}
      />
    )

    const cancelBtn = screen.getByRole('button', {
      name: 'settings:conflictDialog.cancel',
    })
    fireEvent.click(cancelBtn)

    expect(onClose).toHaveBeenCalled()
  })

  it('disables buttons when isLoading is true', () => {
    render(
      <ConflictDialog
        open={true}
        conflictData={mockConflict}
        isLoading={true}
        onKeepLocal={vi.fn()}
        onUseCloud={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(
      screen.getByRole('button', { name: 'settings:conflictDialog.keepLocal' })
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: 'settings:conflictDialog.useCloud' })
    ).toHaveProperty('disabled', true)
    expect(
      screen.getByRole('button', { name: 'settings:conflictDialog.cancel' })
    ).toHaveProperty('disabled', true)
  })
})
