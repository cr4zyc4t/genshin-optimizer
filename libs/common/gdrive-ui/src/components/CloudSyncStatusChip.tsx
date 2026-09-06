import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudSync } from '../hooks/useCloudSync'
import type { SyncStatus } from '@genshin-optimizer/common/gdrive'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Chip,
  type ChipProps,
  CircularProgress,
  type SxProps,
  type Theme,
  Tooltip,
} from '@mui/material'

export interface CloudSyncStatusChipProps
  extends Omit<ChipProps, 'color' | 'icon' | 'label'> {
  labels?: Partial<Record<SyncStatus, string>>
  showUnauthenticated?: boolean
  showLabel?: boolean
  iconOnly?: boolean
  showPendingSync?: boolean
  onConflictClick?: () => void
  tooltip?: string | ReactNode
  to?: string
  [key: string]: unknown
}

export function CloudSyncStatusChip({
  labels,
  showUnauthenticated = false,
  showLabel = true,
  iconOnly = false,
  showPendingSync = false,
  onConflictClick,
  tooltip,
  onClick,
  size = 'small',
  sx,
  ...chipProps
}: CloudSyncStatusChipProps) {
  const { t } = useTranslation(['settings', 'ui'])
  const { session, syncState } = useCloudSync()

  if (
    !showUnauthenticated &&
    (!session || syncState.status === 'UNAUTHENTICATED')
  ) {
    return null
  }

  const isIconOnly = Boolean(iconOnly || !showLabel)

  let statusLabel = t('settings:cloudSync.status.idle')
  let statusTooltip: ReactNode = syncState.lastSyncTime
    ? t('settings:cloudSync.statusTooltip.idleWithTime', {
        time: new Date(syncState.lastSyncTime).toLocaleTimeString(),
      })
    : t('settings:cloudSync.statusTooltip.idle')
  let color: ChipProps['color'] = 'success'
  let variant: ChipProps['variant'] = 'outlined'
  let icon = <CloudDoneIcon />

  switch (syncState.status) {
    case 'SYNCING':
      statusLabel = t('settings:cloudSync.status.syncing')
      statusTooltip = t('settings:cloudSync.statusTooltip.syncing')
      color = 'info'
      variant = 'outlined'
      icon = (
        <CircularProgress size={size === 'small' ? 16 : 20} color="inherit" />
      )
      break
    case 'DEBOUNCING':
      if (showPendingSync) {
        statusLabel = t('settings:cloudSync.status.debouncing')
        statusTooltip = t('settings:cloudSync.statusTooltip.debouncing')
        color = 'warning'
        variant = 'outlined'
        icon = <AccessTimeIcon />
      }
      break
    case 'CONFLICT':
      statusLabel = t('settings:cloudSync.status.conflict')
      statusTooltip = t('settings:cloudSync.statusTooltip.conflict')
      color = 'error'
      variant = 'filled'
      icon = <WarningAmberIcon />
      break
    case 'ERROR':
      statusLabel = t('settings:cloudSync.status.error')
      statusTooltip =
        syncState.errorMessage || t('settings:cloudSync.statusTooltip.error')
      color = 'error'
      variant = 'outlined'
      icon = <ErrorOutlineIcon />
      break
    case 'UNAUTHENTICATED':
      statusLabel = t('settings:cloudSync.status.unauthenticated')
      statusTooltip = t('settings:cloudSync.statusTooltip.unauthenticated')
      color = 'default'
      variant = 'outlined'
      icon = <CloudOffIcon />
      break
    default:
      break
  }

  const labelText = labels?.[syncState.status] ?? statusLabel
  const tooltipContent = tooltip ?? statusTooltip

  const handleClick =
    syncState.status === 'CONFLICT' && onConflictClick
      ? onConflictClick
      : onClick

  const isClickable = Boolean(
    handleClick || chipProps.component || chipProps.clickable
  )

  const dimension = size === 'small' ? 28 : 36

  const iconOnlySx: SxProps<Theme> = isIconOnly
    ? {
        width: dimension,
        height: dimension,
        minWidth: dimension,
        maxWidth: dimension,
        p: 0,
        borderRadius: '50%',
        justifyContent: 'center',
        boxSizing: 'border-box',
        ...(variant === 'filled' && { border: '1px solid transparent' }),
        '& .MuiChip-label': {
          display: 'none',
          p: 0,
        },
        '& .MuiChip-icon': {
          m: 0,
          fontSize: size === 'small' ? 18 : 22,
        },
      }
    : {}

  const chipElement = (
    <Chip
      aria-label={
        isIconOnly
          ? ((chipProps['aria-label'] as string) ?? labelText)
          : undefined
      }
      {...chipProps}
      icon={icon}
      label={isIconOnly ? undefined : labelText}
      color={color}
      size={size}
      variant={variant}
      clickable={isClickable}
      onClick={handleClick}
      sx={[
        ...(isIconOnly ? [iconOnlySx] : []),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
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
