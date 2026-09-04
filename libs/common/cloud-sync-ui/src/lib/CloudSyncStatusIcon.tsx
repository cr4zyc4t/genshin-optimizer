import CloudDoneIcon from '@mui/icons-material/CloudDone'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import SyncProblemIcon from '@mui/icons-material/SyncProblem'
import type { IconButtonProps } from '@mui/material'
import { IconButton, Tooltip } from '@mui/material'
import type { ElementType } from 'react'
import { useContext } from 'react'
import { CloudSyncContext } from './CloudSyncContext'

export type CloudSyncStatusIconProps<C extends ElementType = 'button'> =
  IconButtonProps<C, { component?: C; to?: string }> & {
    /** If true, shows a subtle disabled cloud icon when user is not signed in. Defaults to false (hidden when signed out). */
    showWhenSignedOut?: boolean
    /** Optional custom labels / tooltip overrides. */
    labels?: {
      syncing?: string
      synced?: string | ((time?: string) => string)
      error?: string
      conflict?: string
      dirty?: string
      disabled?: string
      idle?: string
      signedOut?: string
    }
  }

const spinSx = {
  animation: 'cloudSyncSpin 2s linear infinite',
  '@keyframes cloudSyncSpin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
}

/**
 * Universal top-bar / header icon notifying the active database's cloud sync status:
 * - Syncing: spinning cloud sync icon
 * - Success / Synced: green cloud done icon
 * - Fail / Error: red cloud off icon
 * - Conflict: red sync problem icon
 * - Dirty / Pending: orange cloud upload icon
 * - Disabled: subtle grey cloud off icon
 */
export function CloudSyncStatusIcon<C extends ElementType = 'button'>({
  showWhenSignedOut = false,
  labels,
  sx,
  ...iconButtonProps
}: CloudSyncStatusIconProps<C>) {
  const { configured, authStatus, status, meta } = useContext(CloudSyncContext)

  if (!configured) return null
  if (authStatus === 'signed-out' && !showWhenSignedOut) return null

  const timeStr = meta?.lastSyncedRemoteModifiedTime
    ? new Date(meta.lastSyncedRemoteModifiedTime).toLocaleTimeString()
    : undefined

  const { icon, tooltipText } = (() => {
    if (authStatus === 'signed-out') {
      return {
        icon: <CloudQueueIcon color="disabled" />,
        tooltipText: labels?.signedOut ?? 'Not signed in to Google Drive',
      }
    }
    if (authStatus === 'signing-in' || status === 'syncing') {
      return {
        icon: <CloudSyncIcon color="info" sx={spinSx} />,
        tooltipText: labels?.syncing ?? 'Syncing with Google Drive…',
      }
    }
    if (status === 'error') {
      return {
        icon: <CloudOffIcon color="error" />,
        tooltipText: labels?.error ?? 'Cloud sync failed, will retry',
      }
    }
    if (status === 'conflict') {
      return {
        icon: <SyncProblemIcon color="error" />,
        tooltipText: labels?.conflict ?? 'Cloud sync conflict — action needed',
      }
    }
    if (status === 'dirty') {
      return {
        icon: <CloudUploadIcon color="warning" />,
        tooltipText: labels?.dirty ?? 'Pending changes to sync…',
      }
    }
    if (status === 'disabled') {
      return {
        icon: <CloudOffIcon color="disabled" />,
        tooltipText:
          labels?.disabled ?? 'Cloud sync disabled for this database',
      }
    }
    // 'synced' or 'idle' with a known last sync time
    if (status === 'synced' || meta?.lastSyncedRemoteModifiedTime) {
      const label =
        typeof labels?.synced === 'function'
          ? labels.synced(timeStr)
          : (labels?.synced ??
            (timeStr ? `Synced (${timeStr})` : 'Synced with Google Drive'))
      return {
        icon: <CloudDoneIcon color="success" />,
        tooltipText: label,
      }
    }
    return {
      icon: <CloudQueueIcon color="action" />,
      tooltipText: labels?.idle ?? 'Cloud sync idle',
    }
  })()

  return (
    <Tooltip title={tooltipText} arrow>
      <IconButton
        size="small"
        color="inherit"
        sx={{ p: 0.75, ...sx }}
        aria-label={tooltipText}
        {...iconButtonProps}
      >
        {icon}
      </IconButton>
    </Tooltip>
  )
}
