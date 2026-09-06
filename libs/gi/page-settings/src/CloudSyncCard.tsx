import {
  CloudSyncStatusChip,
  ConflictDialog,
  useCloudSync,
} from '@genshin-optimizer/common/gdrive-ui'
import type { ConflictComparison } from '@genshin-optimizer/common/gdrive'
import { CardThemed } from '@genshin-optimizer/common/ui'
import CloudSyncIcon from '@mui/icons-material/CloudSync'
import GoogleIcon from '@mui/icons-material/Google'
import LogoutIcon from '@mui/icons-material/Logout'
import SyncIcon from '@mui/icons-material/Sync'
import {
  Alert,
  Avatar,
  Box,
  Button,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CloudSyncCard() {
  const { t } = useTranslation(['settings'])

  const {
    session,
    isAuthLoading,
    authError,
    login,
    logout,
    syncState,
    activeConflict,
    syncNow,
    forceUpload,
    resolveWithCloud,
  } = useCloudSync()

  const [conflictModalOpen, setConflictModalOpen] = useState(false)
  const [dismissedConflict, setDismissedConflict] =
    useState<ConflictComparison | null>(null)

  const formatLastSync = () => {
    if (!syncState.lastSyncTime) return t('cloudSync.neverSynced')
    return t('cloudSync.lastSync', {
      time: new Date(syncState.lastSyncTime).toLocaleString(),
    })
  }

  const isConflictActive = syncState.status === 'CONFLICT' && !!activeConflict
  const isModalOpen =
    conflictModalOpen ||
    (isConflictActive && dismissedConflict !== activeConflict)

  return (
    <>
      <CardThemed bgt="light">
        <CardContent
          sx={{
            py: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CloudSyncIcon color="primary" />
            {t('cloudSync.title')}
          </Typography>
          <CloudSyncStatusChip
            onConflictClick={() => {
              setDismissedConflict(null)
              setConflictModalOpen(true)
            }}
          />
        </CardContent>
        <Divider />
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {authError && <Alert severity="error">{authError}</Alert>}
          {syncState.errorMessage && (
            <Alert severity="error">{syncState.errorMessage}</Alert>
          )}

          {activeConflict && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setDismissedConflict(null)
                    setConflictModalOpen(true)
                  }}
                >
                  {t('cloudSync.resolveConflict')}
                </Button>
              }
            >
              {t('cloudSync.disparityWarning')}
            </Alert>
          )}

          {!session ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'flex-start',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('cloudSync.loginMsg')}
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={
                  isAuthLoading ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <GoogleIcon />
                  )
                }
                disabled={isAuthLoading}
                onClick={() => login()}
              >
                {t('cloudSync.loginBtn')}
              </Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    src={session.picture}
                    alt={session.name}
                    sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}
                  >
                    {session.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2">{session.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {session.email}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SyncIcon />}
                    disabled={syncState.status === 'SYNCING'}
                    onClick={() => syncNow()}
                  >
                    {t('cloudSync.syncNowBtn')}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<LogoutIcon />}
                    disabled={isAuthLoading}
                    onClick={() => logout()}
                  >
                    {t('cloudSync.logoutBtn')}
                  </Button>
                </Stack>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pt: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {formatLastSync()}
                </Typography>
              </Box>
            </Stack>
          )}
        </CardContent>
      </CardThemed>

      <ConflictDialog
        open={isModalOpen}
        conflictData={activeConflict}
        isLoading={syncState.status === 'SYNCING'}
        onKeepLocal={async () => {
          await forceUpload()
          setDismissedConflict(null)
          setConflictModalOpen(false)
        }}
        onUseCloud={async () => {
          await resolveWithCloud()
          setDismissedConflict(null)
          setConflictModalOpen(false)
        }}
        onClose={() => {
          setDismissedConflict(activeConflict)
          setConflictModalOpen(false)
        }}
      />
    </>
  )
}
export default CloudSyncCard
