import type { AuthIdentity } from '../auth.types'
import { ROLE_LABELS } from '../auth.types'

interface AuthenticatedRoleViewProps {
  identity: AuthIdentity
  onLogout: () => Promise<void>
}

export function AuthenticatedRoleView({ identity, onLogout }: AuthenticatedRoleViewProps) {
  const roleLabel = ROLE_LABELS[identity.role]

  return (
    <section className="role-page">
      <section className="role-card">
        <img src="/images/logo-it-key.png" alt="ITD336" />
        <span className="role-badge">{roleLabel}</span>
        <h1>ยินดีต้อนรับ {identity.fullName}</h1>
        <p>ขณะนี้คุณอยู่ในหน้าจอสำหรับ{roleLabel}</p>
        <small>{identity.email}</small>
        <button type="button" onClick={() => void onLogout()}>ออกจากระบบ</button>
      </section>
    </section>
  )
}
