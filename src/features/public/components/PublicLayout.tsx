import { Link, Outlet } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'

export function PublicLayout({ identity, loading, onLogout }: { identity: AuthIdentity | null; loading: boolean; onLogout: () => Promise<void> }) {
  return <div className="student-shell public-shell"><header><Link to="/"><img src="/images/logo-it-key.png" alt="ITD336" /></Link><div className="public-account">{loading ? <small>กำลังตรวจสอบบัญชี…</small> : identity ? <><strong>{identity.fullName}</strong>{identity.role === 'ADMIN' && <Link className="header-link" to="/admin">ระบบผู้ดูแล</Link>}<button onClick={() => void onLogout()}>ออกจากระบบ</button></> : <Link className="header-link login-link" to="/login">เข้าสู่ระบบ</Link>}</div></header><main><Outlet /></main></div>
}
