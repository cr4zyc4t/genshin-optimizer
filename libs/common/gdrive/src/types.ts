export interface CloudAccountSession {
  sub?: string | undefined
  email: string
  name: string
  picture?: string | undefined
  accessToken: string
  expiresAt: number
  scope: string
}

export type SyncStatus =
  | 'UNAUTHENTICATED'
  | 'IDLE'
  | 'DEBOUNCING'
  | 'SYNCING'
  | 'CONFLICT'
  | 'ERROR'

export interface SyncRuntimeMetadata {
  status: SyncStatus
  lastSyncTime: number | null
  remoteFileId: string | null
  remoteModifiedTime: string | null
  lastRemoteHash: string | null
  isLocalDirty: boolean
  errorMessage: string | null
}

export interface UnifiedSlotEntry<SlotData = unknown> {
  name: string
  lastEdit: number
  data: SlotData
}

export interface UnifiedSyncPackage<SlotData = unknown> {
  version: 1
  appId: string
  createdAt: number
  contentHash: string
  slots: {
    1: UnifiedSlotEntry<SlotData>
    2: UnifiedSlotEntry<SlotData>
    3: UnifiedSlotEntry<SlotData>
    4: UnifiedSlotEntry<SlotData>
  }
}

export interface SlotSummary {
  name: string
  lastEdit: number
  characterCount: number
  artifactCount: number
  weaponCount: number
}

export interface SyncVersionDescriptor {
  timestamp: number
  byteSize: number
  slots: Record<1 | 2 | 3 | 4, SlotSummary>
}

export interface ConflictComparison {
  local: SyncVersionDescriptor
  cloud: SyncVersionDescriptor
  hasSevereDisparity: boolean
  disparityWarningText?: string | undefined
}

export interface GISConfig {
  clientId: string
  scope?: string | undefined
}

export interface DriveFileMetadata {
  id: string
  name: string
  modifiedTime: string
  size?: string | undefined
  version?: string | undefined
}
