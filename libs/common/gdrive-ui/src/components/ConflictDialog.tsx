import type { ConflictComparison } from '@genshin-optimizer/common/gdrive'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import CloudDownloadIcon from '@mui/icons-material/CloudDownload'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

export interface ConflictDialogProps {
  open: boolean
  conflictData: ConflictComparison | null
  onKeepLocal: () => Promise<void> | void
  onUseCloud: () => Promise<void> | void
  onClose: () => void
  isLoading?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function ConflictDialog({
  open,
  conflictData,
  onKeepLocal,
  onUseCloud,
  onClose,
  isLoading = false,
}: ConflictDialogProps) {
  const { t } = useTranslation(['settings', 'ui'])

  if (!conflictData) return null

  const { local, cloud, hasSevereDisparity } = conflictData
  const isLocalNewer = local.timestamp > cloud.timestamp
  const isCloudNewer = cloud.timestamp > local.timestamp

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        {t('settings:conflictDialog.title')}
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          {t('settings:conflictDialog.desc')}
        </Typography>

        {hasSevereDisparity && (
          <Alert severity="warning">
            {t('settings:conflictDialog.disparityAlert')}
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Local Device Version */}
          <Grid item xs={12} sm={6}>
            <Card
              variant="outlined"
              sx={{ height: '100%', borderColor: 'primary.main' }}
            >
              <CardContent>
                <Typography variant="h6" color="primary.main" gutterBottom>
                  {t('settings:conflictDialog.localTitle')}
                </Typography>
                <Typography variant="body2">
                  {t('settings:conflictDialog.modified', {
                    time: new Date(local.timestamp).toLocaleString(),
                  })}
                  {local.timestamp !== cloud.timestamp && (
                    <Box
                      component="span"
                      sx={{
                        color: isLocalNewer ? 'success.main' : 'error.main',
                        fontWeight: 'bold',
                        ml: 1,
                      }}
                    >
                      {isLocalNewer ? 'NEW' : 'OLD'}
                    </Box>
                  )}
                </Typography>
                <Typography variant="body2">
                  {t('settings:conflictDialog.size', {
                    size: formatBytes(local.byteSize),
                  })}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {([1, 2, 3, 4] as const).map((slotNum) => {
                    const slot = local.slots[slotNum]
                    const name =
                      slot?.name ||
                      t('settings:conflictDialog.defaultSlotName', { slotNum })
                    return (
                      <Box
                        key={slotNum}
                        sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}
                      >
                        <Typography variant="subtitle2">
                          {t('settings:conflictDialog.slotTitle', {
                            slotNum,
                            name,
                          })}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {t('settings:conflictDialog.slotDetails', {
                            characters: slot?.characterCount ?? 0,
                            artifacts: slot?.artifactCount ?? 0,
                            weapons: slot?.weaponCount ?? 0,
                          })}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Cloud Backup Version */}
          <Grid item xs={12} sm={6}>
            <Card
              variant="outlined"
              sx={{ height: '100%', borderColor: 'info.main' }}
            >
              <CardContent>
                <Typography variant="h6" color="info.main" gutterBottom>
                  {t('settings:conflictDialog.cloudTitle')}
                </Typography>
                <Typography variant="body2">
                  {t('settings:conflictDialog.modified', {
                    time: new Date(cloud.timestamp).toLocaleString(),
                  })}
                  {local.timestamp !== cloud.timestamp && (
                    <Box
                      component="span"
                      sx={{
                        color: isCloudNewer ? 'success.main' : 'error.main',
                        fontWeight: 'bold',
                        ml: 1,
                      }}
                    >
                      {isCloudNewer ? 'NEW' : 'OLD'}
                    </Box>
                  )}
                </Typography>
                <Typography variant="body2">
                  {t('settings:conflictDialog.size', {
                    size: formatBytes(cloud.byteSize),
                  })}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {([1, 2, 3, 4] as const).map((slotNum) => {
                    const slot = cloud.slots[slotNum]
                    const name =
                      slot?.name ||
                      t('settings:conflictDialog.defaultSlotName', { slotNum })
                    return (
                      <Box
                        key={slotNum}
                        sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}
                      >
                        <Typography variant="subtitle2">
                          {t('settings:conflictDialog.slotTitle', {
                            slotNum,
                            name,
                          })}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          {t('settings:conflictDialog.slotDetails', {
                            characters: slot?.characterCount ?? 0,
                            artifacts: slot?.artifactCount ?? 0,
                            weapons: slot?.weaponCount ?? 0,
                          })}
                        </Typography>
                      </Box>
                    )
                  })}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={isLoading} color="inherit">
          {t('settings:conflictDialog.cancel')}
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              isLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CloudUploadIcon />
              )
            }
            disabled={isLoading}
            onClick={onKeepLocal}
          >
            {t('settings:conflictDialog.keepLocal')}
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={
              isLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CloudDownloadIcon />
              )
            }
            disabled={isLoading}
            onClick={onUseCloud}
          >
            {t('settings:conflictDialog.useCloud')}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}
