import type { AuthIdentity } from '../../auth/auth.types'
import { displayRoleFromEmail } from '../../auth/utils/account-display'
import { AccountAvatar } from './AccountAvatar'

export function AccountIdentitySummary({ identity }: { identity: AuthIdentity | null }) {
  if (!identity) return <AccountAvatar identity={null} />

  const displayName = identity.fullName.trim() || identity.email.trim() || 'ผู้ใช้งาน'
  const displayIdentity = { ...identity, fullName: displayName }

  return <>
    <AccountAvatar identity={displayIdentity} />
    <span className="key-account-copy">
      <strong className="key-account-name" title={displayName}>{displayName}</strong>
      <small className="key-account-role">{displayRoleFromEmail(identity.email)}</small>
    </span>
  </>
}
