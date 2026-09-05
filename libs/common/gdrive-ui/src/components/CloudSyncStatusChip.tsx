import type { ReactNode } from 'react'
import { useCloudSync } from '../hooks/useCloudSync'
import type { SyncStatus } from '@genshin-optimizer/common/gdrive'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Chip, type ChipProps, CircularProgress, Tooltip } from '@mui/material'

export interface CloudSyncStatusChipProps
  extends Omit<ChipProps, 'color' | 'icon' | 'label'> {
  labels?: Partial<Record<SyncStatus, string>>
  showUnauthenticated?: boolean
  showLabel?: boolean
  onConflictClick?: () => void
  tooltip?: string | ReactNode
  to?: string
  [key: string]: unknown
}

export function CloudSyncStatusChip({
  labels,
  showUnauthenticated = false,
  showLabel = true,
  onConflictClick,
  tooltip,
  onClick,
  size = 'small',
  sx,
  ...chipProps
}: CloudSyncStatusChipProps) {
  const { session, syncState } = useCloudSync()

  if (
    !showUnauthenticated &&
    (!session || syncState.status === 'UNAUTHENTICATED')
  ) {
    return null
  }

  let defaultLabel = 'Synced'
  let defaultTooltip: ReactNode = 'Google Drive: Synced'
  let color: ChipProps['color'] = 'success'
  let variant: ChipProps['variant'] = 'outlined'
  let icon = <CloudDoneIcon />

  switch (syncState.status) {
    case 'SYNCING':
      defaultLabel = 'Syncing...'
      defaultTooltip = 'Google Drive: Syncing data...'
      color = 'info'
      variant = 'outlined'
      icon = <CircularProgress size={14} color="inherit" />
      break
    case 'DEBOUNCING':
      defaultLabel = 'Pending'
      defaultTooltip = 'Google Drive: Pending changes (syncing in 10s)'
      color = 'warning'
      variant = 'outlined'
      icon = <AccessTimeIcon />
      break
    case 'CONFLICT':
      defaultLabel = 'Conflict'
      defaultTooltip =
        'Google Drive: Conflict detected between local and cloud data'
      color = 'error'
      variant = 'filled'
      icon = <WarningAmberIcon />
      break
    case 'ERROR':
      defaultLabel = 'Error'
      defaultTooltip =
        syncState.errorMessage || 'Google Drive: Synchronization error'
      color = 'error'
      variant = 'outlined'
      icon = <ErrorOutlineIcon />
      break
    case 'UNAUTHENTICATED':
      defaultLabel = 'Not Connected'
      defaultTooltip = 'Google Drive: Not connected'
      color = 'default'
      variant = 'outlined'
      icon = <CloudOffIcon />
      break
    default:
      defaultLabel = 'Synced'
      defaultTooltip = syncState.lastSyncTime
        ? `Google Drive: Synced (Last: ${new Date(
            syncState.lastSyncTime
          ).toLocaleTimeString()})`
        : 'Google Drive: Synced'
      color = 'success'
      variant = 'outlined'
      icon = <CloudDoneIcon />
      break
  }

  const labelText = labels?.[syncState.status] ?? defaultLabel
  const tooltipContent = tooltip ?? defaultTooltip

  const handleClick =
    syncState.status === 'CONFLICT' && onConflictClick
      ? onConflictClick
      : onClick

  const isClickable = Boolean(
    handleClick || chipProps.component || chipProps.clickable
  )

  const chipElement = (
    <Chip
      {...chipProps}
      icon={icon}
      label={showLabel ? labelText : undefined}
      color={color}
      size={size}
      variant={variant}
      clickable={isClickable}
      onClick={handleClick}
      sx={sx}
    />
  )

  if (tooltipContent) {
    return (
      <Tooltip arrow title={tooltipContent}>
        {chipElement}
      </Tooltip>
    )
  }

  return chipElement
}
