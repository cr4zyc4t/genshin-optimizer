import {
  DEBOUNCE_MAX_MS,
  DEBOUNCE_MIN_MS,
} from '@genshin-optimizer/common/cloud-sync'
import {
  ConflictDialog,
  SignInButton,
} from '@genshin-optimizer/common/cloud-sync-ui'
import { useDataEntryBase } from '@genshin-optimizer/common/database-ui'
import { CardThemed } from '@genshin-optimizer/common/ui'
import { range } from '@genshin-optimizer/common/util'
import { DatabaseContext } from '@genshin-optimizer/gi/db-ui'
import {
  Box,
  Button,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { CloudSyncContext } from '../../context/CloudSyncContext'

export function CloudSyncCard() {
  const { t } = useTranslation(['settings'])
  const { configured, authStatus, signIn, signOut, settings, setSettings } =
    useContext(CloudSyncContext)

  if (!configured) return null

  return (
    <CardThemed bgt="light">
      <CardContent sx={{ py: 1 }}>
        <Typography variant="subtitle1">{t('cloudSyncCard.title')}</Typography>
      </CardContent>
      <Divider />
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('cloudSyncCard.desc')}
        </Typography>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <SignInButton
            status={authStatus}
            signInLabel={t('cloudSyncCard.signIn')}
            signingInLabel={t('cloudSyncCard.signingIn')}
            signOutLabel={t('cloudSyncCard.signOut')}
            onSignIn={signIn}
            onSignOut={signOut}
          />
          {authStatus === 'signed-in' && (
            <TextField
              size="small"
              type="number"
              label={t('cloudSyncCard.debounceLabel')}
              value={Math.round(settings.debounceMs / 1000)}
              onChange={(e) => {
                const seconds = Number(e.target.value)
                if (Number.isNaN(seconds)) return
                setSettings({ debounceMs: seconds * 1000 })
              }}
              inputProps={{
                min: DEBOUNCE_MIN_MS / 1000,
                max: DEBOUNCE_MAX_MS / 1000,
              }}
              sx={{ width: 220 }}
            />
          )}
        </Box>
        {authStatus === 'signed-in' && (
          <Grid container spacing={2} columns={{ xs: 1, md: 2 }}>
            {range(0, 3).map((i) => (
              <Grid key={i} item xs={1}>
                <SlotRow index={i} />
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </CardThemed>
  )
}

function SlotRow({ index }: { index: number }) {
  const { t } = useTranslation(['settings'])
  const { databases, database: activeDatabase } = useContext(DatabaseContext)
  const database = databases[index]
  const cloudSyncMeta = useDataEntryBase(database.cloudSyncMeta)
  const isActive = database === activeDatabase
  const { status, meta, conflictInfo, setEnabled, syncNow, resolveConflict } =
    useContext(CloudSyncContext)

  const onToggle = useCallback(
    (checked: boolean) => {
      if (isActive) setEnabled(checked)
      else database.cloudSyncMeta.set({ enabled: checked })
    },
    [isActive, setEnabled, database]
  )

  const statusText = (() => {
    if (!cloudSyncMeta.enabled) return t('cloudSyncCard.status.disabled')
    if (!isActive) return t('cloudSyncCard.inactiveSlot')
    if (status === 'dirty') return t('cloudSyncCard.status.dirty')
    if (status === 'syncing') return t('cloudSyncCard.status.syncing')
    if (status === 'conflict') return t('cloudSyncCard.status.conflict')
    if (status === 'error') return t('cloudSyncCard.status.error')
    if (status === 'synced' && meta?.lastSyncedRemoteModifiedTime)
      return t('cloudSyncCard.status.synced', {
        time: new Date(meta.lastSyncedRemoteModifiedTime).toLocaleString(),
      })
    return t('cloudSyncCard.status.idle')
  })()

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap={1}
      p={1}
      border={1}
      borderColor="divider"
      borderRadius={1}
    >
      <FormControlLabel
        control={
          <Checkbox
            checked={cloudSyncMeta.enabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
        }
        label={
          <Box>
            <Typography>
              {t('cloudSyncCard.enableToggle')}{' '}
              <Chip
                size="small"
                label={`${t('DatabaseCard.title')} ${database.dbIndex}`}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {statusText}
            </Typography>
          </Box>
        }
      />
      {isActive && cloudSyncMeta.enabled && (
        <Button size="small" onClick={() => syncNow()}>
          {t('cloudSyncCard.syncNow')}
        </Button>
      )}
      {isActive && (
        <ConflictDialog
          open={status === 'conflict'}
          conflict={conflictInfo}
          labels={{
            title: t('cloudSyncCard.conflictDialog.title'),
            desc: t('cloudSyncCard.conflictDialog.desc'),
            local: t('cloudSyncCard.conflictDialog.local'),
            cloud: t('cloudSyncCard.conflictDialog.cloud'),
            lastModified: t('cloudSyncCard.conflictDialog.lastModified'),
            size: t('cloudSyncCard.conflictDialog.size'),
            keepLocal: t('cloudSyncCard.conflictDialog.keepLocal'),
            keepCloud: t('cloudSyncCard.conflictDialog.keepCloud'),
            cancel: t('cloudSyncCard.conflictDialog.cancel'),
          }}
          onKeepLocal={() => resolveConflict('keepLocal')}
          onKeepCloud={() => resolveConflict('keepCloud')}
          onCancel={() => {
            /* leave status as 'conflict', ask again next sync */
          }}
        />
      )}
    </Box>
  )
}
