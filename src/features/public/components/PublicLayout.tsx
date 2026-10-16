import { Link, NavLink, Outlet } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { NotificationBell } from '../../notifications/components/NotificationBell'

const publicLinks = [['/', 'ภาพรวม']]
const accountLinks = [['/account/requests', 'การจองและกุญแจ'], ['/account/history', 'ประวัติการใช้งาน']]

export function PublicLayout({ identity, loading, onLogout }: { identity: AuthIdentity | null; loading: boolean; onLogout: () => Promise<void> }) {
  const links = identity ? [...publicLinks, ...accountLinks] : publicLinks
  return <div className="student-shell public-shell">
    <aside className="public-sidebar"><Link className="public-brand" to="/"><img src="/images/logo-it-key.png" alt="ITD336" /></Link><small>พื้นที่ทำงาน · นักศึกษา</small><nav>{links.map(([to, label]) => <NavLink end={to === '/'} key={to} to={to}>{label}</NavLink>)}</nav></aside>
    <div className="public-main"><header><div className="public-account">{loading ? <small>กำลังตรวจสอบบัญชี…</small> : identity ? <><NotificationBell/><strong>{identity.fullName}</strong>{identity.role === 'ADMIN' && <Link className="header-link" to="/admin">ระบบผู้ดูแล</Link>}<button onClick={() => void onLogout()}>ออกจากระบบ</button></> : <Link className="header-link login-link" to="/login">เข้าสู่ระบบ</Link>}</div></header><main><Outlet /></main></div>
  </div>
}
