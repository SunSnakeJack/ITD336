import type { AuthIdentity } from '../../auth/auth.types'
import { ROLE_LABELS } from '../../auth/auth.types'
import { compactAccountName } from '../../auth/utils/account-display'
import { AccountAvatar } from './AccountAvatar'

export function AccountIdentitySummary({ identity }: { identity: AuthIdentity | null }) {
  if (!identity) return <AccountAvatar identity={null} />

  const displayName = identity.givenName?.trim() || compactAccountName(identity.fullName,identity.email)
  const displayIdentity = { ...identity, fullName: identity.fullName.trim() || displayName }

  return <>
    <AccountAvatar identity={displayIdentity} />
    <span className="key-account-copy">
      <strong className="key-account-name" title={displayName}>{displayName}</strong>
      <small className="key-account-role">{identity.role ? ROLE_LABELS[identity.role] : 'ยังไม่ได้กำหนดบทบาท'}</small>
    </span>
  </>
}
