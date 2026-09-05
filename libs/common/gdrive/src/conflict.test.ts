import { describe, it, expect } from 'vitest'
import { computeSevereDisparity, buildConflictComparison } from './conflict'
import type { SlotSummary } from './types'

describe('conflict utilities', () => {
  const emptySummary: SlotSummary = {
    name: 'Slot',
    lastEdit: 0,
    characterCount: 0,
    artifactCount: 0,
    weaponCount: 0,
  }

  const populatedSummary: SlotSummary = {
    name: 'Main',
    lastEdit: 1000,
    characterCount: 20,
    artifactCount: 150,
    weaponCount: 30, // Total: 200 items
  }

  it('detects severe disparity when one slot is empty in one version but populated in the other', () => {
    const local = {
      1: populatedSummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }
    const cloud = {
      1: emptySummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }

    expect(computeSevereDisparity(local, cloud, 5000, 100)).toBe(true)
  })

  it('detects severe disparity when item count differs by > 25%', () => {
    // 200 items vs 140 items -> (200 - 140) / 200 = 30% > 25%
    const local = {
      1: populatedSummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }
    const cloud = {
      1: { ...populatedSummary, artifactCount: 90 }, // Total: 140 items
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }

    expect(computeSevereDisparity(local, cloud, 5000, 4800)).toBe(true)
  })

  it('detects severe disparity when payload byte size differs by > 35%', () => {
    // Items are close (190 vs 200 = 5%), but byte size differs by 40% (10000 vs 6000)
    const local = {
      1: populatedSummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }
    const cloud = {
      1: { ...populatedSummary, artifactCount: 140 }, // Total: 190 items
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }

    expect(computeSevereDisparity(local, cloud, 10000, 6000)).toBe(true)
  })

  it('does not flag disparity for minor routine changes', () => {
    // 200 items vs 196 items (2%), byte size 5000 vs 4900 (2%)
    const local = {
      1: populatedSummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }
    const cloud = {
      1: { ...populatedSummary, artifactCount: 146 },
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }

    expect(computeSevereDisparity(local, cloud, 5000, 4900)).toBe(false)
  })

  it('builds ConflictComparison descriptor with warning text when disparity exists', () => {
    const local = {
      1: populatedSummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }
    const cloud = {
      1: emptySummary,
      2: emptySummary,
      3: emptySummary,
      4: emptySummary,
    }

    const comparison = buildConflictComparison({
      localSummaries: local,
      cloudSummaries: cloud,
      localTimestamp: 1000,
      cloudTimestamp: 2000,
      localBytes: 15000,
      cloudBytes: 500,
    })

    expect(comparison.hasSevereDisparity).toBe(true)
    expect(comparison.disparityWarningText).toBeDefined()
    expect(comparison.local.byteSize).toBe(15000)
    expect(comparison.cloud.byteSize).toBe(500)
  })
})
