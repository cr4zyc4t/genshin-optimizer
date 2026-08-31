import type { GoogleAuthStatus } from '@genshin-optimizer/common/cloud-sync'
import { Button } from '@mui/material'

/** Sign-in/sign-out button (design doc §11). Game-agnostic — caller supplies translated labels. */
export function SignInButton({
  status,
  signInLabel,
  signingInLabel,
  signOutLabel,
  onSignIn,
  onSignOut,
}: {
  status: GoogleAuthStatus
  signInLabel: string
  signingInLabel: string
  signOutLabel: string
  onSignIn: () => void
  onSignOut: () => void
}) {
  if (status === 'signed-in') {
    return (
      <Button fullWidth color="error" onClick={onSignOut}>
        {signOutLabel}
      </Button>
    )
  }
  return (
    <Button
      fullWidth
      color="success"
      onClick={onSignIn}
      disabled={status === 'signing-in'}
    >
      {status === 'signing-in' ? signingInLabel : signInLabel}
    </Button>
  )
}
