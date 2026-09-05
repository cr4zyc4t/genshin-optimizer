import type { ConflictComparison, SlotSummary } from './types'

export interface BuildConflictComparisonParams {
  localSummaries: Record<1 | 2 | 3 | 4, SlotSummary>
  cloudSummaries: Record<1 | 2 | 3 | 4, SlotSummary>
  localTimestamp: number
  cloudTimestamp: number
  localBytes: number
  cloudBytes: number
}

/**
 * Disparity calculation rule:
 * Flags severe disparity if:
 * 1. Total item count differs by > 25%
 * 2. Total payload byte size differs by > 35%
 * 3. Any slot is empty in one version but populated in the other
 */
export function computeSevereDisparity(
  localSummaries: Record<1 | 2 | 3 | 4, SlotSummary>,
  cloudSummaries: Record<1 | 2 | 3 | 4, SlotSummary>,
  localBytes: number,
  cloudBytes: number
): boolean {
  const localTotalItems = Object.values(localSummaries).reduce(
    (sum, s) => sum + s.characterCount + s.artifactCount + s.weaponCount,
    0
  )
  const cloudTotalItems = Object.values(cloudSummaries).reduce(
    (sum, s) => sum + s.characterCount + s.artifactCount + s.weaponCount,
    0
  )

  const maxItems = Math.max(localTotalItems, cloudTotalItems)
  const minItems = Math.min(localTotalItems, cloudTotalItems)
  const itemDiffRatio = maxItems > 0 ? (maxItems - minItems) / maxItems : 0

  const maxBytes = Math.max(localBytes, cloudBytes)
  const minBytes = Math.min(localBytes, cloudBytes)
  const byteDiffRatio = maxBytes > 0 ? (maxBytes - minBytes) / maxBytes : 0

  const hasEmptySlotDisparity = ([1, 2, 3, 4] as const).some((slotNum) => {
    const lItems =
      localSummaries[slotNum].characterCount +
      localSummaries[slotNum].artifactCount +
      localSummaries[slotNum].weaponCount
    const cItems =
      cloudSummaries[slotNum].characterCount +
      cloudSummaries[slotNum].artifactCount +
      cloudSummaries[slotNum].weaponCount
    return (lItems === 0 && cItems > 0) || (cItems === 0 && lItems > 0)
  })

  return itemDiffRatio > 0.25 || byteDiffRatio > 0.35 || hasEmptySlotDisparity
}

/**
 * Builds structured comparative data model for the Conflict Resolution dialog.
 */
export function buildConflictComparison(
  params: BuildConflictComparisonParams
): ConflictComparison {
  const {
    localSummaries,
    cloudSummaries,
    localTimestamp,
    cloudTimestamp,
    localBytes,
    cloudBytes,
  } = params

  const hasSevereDisparity = computeSevereDisparity(
    localSummaries,
    cloudSummaries,
    localBytes,
    cloudBytes
  )

  return {
    local: {
      timestamp: localTimestamp,
      byteSize: localBytes,
      slots: localSummaries,
    },
    cloud: {
      timestamp: cloudTimestamp,
      byteSize: cloudBytes,
      slots: cloudSummaries,
    },
    hasSevereDisparity,
    disparityWarningText: hasSevereDisparity
      ? 'Caution: One version has substantially less data than the other.'
      : undefined,
  }
}
