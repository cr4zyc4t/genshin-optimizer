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
  if (!conflictData) return null

  const { local, cloud, hasSevereDisparity, disparityWarningText } =
    conflictData

  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        Cloud Synchronization Conflict
      </DialogTitle>
      <DialogContent
        dividers
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="body2" color="text.secondary">
          Divergent changes have been made locally and in your Google Drive
          cloud backup. Please select which version to keep.
        </Typography>

        {hasSevereDisparity && (
          <Alert severity="warning">
            {disparityWarningText ||
              'Caution: One version has substantially less data than the other. Choosing the smaller version may cause irreversible loss of characters or artifacts.'}
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
                  Local Device Data
                </Typography>
                <Typography variant="body2">
                  <strong>Modified:</strong>{' '}
                  {new Date(local.timestamp).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Size:</strong> {formatBytes(local.byteSize)}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {([1, 2, 3, 4] as const).map((slotNum) => {
                    const slot = local.slots[slotNum]
                    return (
                      <Box
                        key={slotNum}
                        sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}
                      >
                        <Typography variant="subtitle2">
                          Slot {slotNum}: {slot?.name || `Database ${slotNum}`}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Characters: {slot?.characterCount ?? 0} | Artifacts:{' '}
                          {slot?.artifactCount ?? 0} | Weapons:{' '}
                          {slot?.weaponCount ?? 0}
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
                  Google Drive Backup
                </Typography>
                <Typography variant="body2">
                  <strong>Modified:</strong>{' '}
                  {new Date(cloud.timestamp).toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Size:</strong> {formatBytes(cloud.byteSize)}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={1}>
                  {([1, 2, 3, 4] as const).map((slotNum) => {
                    const slot = cloud.slots[slotNum]
                    return (
                      <Box
                        key={slotNum}
                        sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}
                      >
                        <Typography variant="subtitle2">
                          Slot {slotNum}: {slot?.name || `Database ${slotNum}`}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                        >
                          Characters: {slot?.characterCount ?? 0} | Artifacts:{' '}
                          {slot?.artifactCount ?? 0} | Weapons:{' '}
                          {slot?.weaponCount ?? 0}
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
          Close (Review Later)
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
            Keep Local Data (Upload to Cloud)
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
            Use Cloud Data (Overwrite Local)
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}
