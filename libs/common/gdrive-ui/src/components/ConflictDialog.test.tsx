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

    expect(screen.getByText('Cloud Synchronization Conflict')).toBeDefined()
    expect(
      screen.getByText(/Caution: One version has substantially less data/i)
    ).toBeDefined()
    expect(screen.getByText(/Local Device Data/i)).toBeDefined()
    expect(screen.getByText(/Google Drive Backup/i)).toBeDefined()
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
      name: /Keep Local Data/i,
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

    const useCloudBtn = screen.getByRole('button', { name: /Use Cloud Data/i })
    fireEvent.click(useCloudBtn)

    expect(onUseCloud).toHaveBeenCalled()
  })
})
