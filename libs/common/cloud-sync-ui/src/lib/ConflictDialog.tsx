import type { ConflictInfo } from '@genshin-optimizer/common/cloud-sync'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material'

export interface ConflictDialogLabels {
  title: string
  desc: string
  local: string
  cloud: string
  lastModified: string
  size: string
  keepLocal: string
  keepCloud: string
  cancel: string
}

/**
 * Whole-snapshot conflict resolution dialog (design doc §10). Game-agnostic — the caller
 * supplies translated labels and the conflict metadata to display.
 */
export function ConflictDialog({
  open,
  conflict,
  labels,
  onKeepLocal,
  onKeepCloud,
  onCancel,
}: {
  open: boolean
  conflict: ConflictInfo | undefined
  labels: ConflictDialogLabels
  onKeepLocal: () => void
  onKeepCloud: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{labels.title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{labels.desc}</DialogContentText>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>{labels.local}</TableCell>
              <TableCell>{labels.cloud}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{labels.lastModified}</TableCell>
              <TableCell>
                {conflict
                  ? new Date(conflict.local.modifiedTime).toLocaleString()
                  : '—'}
              </TableCell>
              <TableCell>
                {conflict
                  ? new Date(conflict.cloud.modifiedTime).toLocaleString()
                  : '—'}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>{labels.size}</TableCell>
              <TableCell>
                {conflict?.local.size !== undefined
                  ? `${conflict.local.size} B`
                  : '—'}
              </TableCell>
              <TableCell>
                {conflict?.cloud.size !== undefined
                  ? `${conflict.cloud.size} B`
                  : '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{labels.cancel}</Button>
        <Button color="warning" onClick={onKeepCloud}>
          {labels.keepCloud}
        </Button>
        <Button color="success" onClick={onKeepLocal}>
          {labels.keepLocal}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
