import { NavLink, Outlet } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'

const links = [
  ['/admin', 'ภาพรวม'], ['/admin/rooms', 'จัดการห้อง'], ['/admin/room-schedule', 'ตารางห้อง'], ['/admin/terms', 'ตั้งค่าภาคเรียน'],
]

export function AdminLayout({ identity, onLogout }: { identity: AuthIdentity; onLogout: () => Promise<void> }) {
  return <div className="app-shell">
    <aside className="app-sidebar">
      <img src="/images/logo-it-key.png" alt="ITD336" />
      <h2>ระบบจัดการห้อง</h2><p>ผู้ดูแลระบบ</p>
      <nav>{links.map(([to, label]) => <NavLink end={to === '/admin'} key={to} to={to}>{label}</NavLink>)}</nav>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><div><strong>{identity.fullName}</strong><small>{identity.email}</small></div><button onClick={() => void onLogout()}>ออกจากระบบ</button></header>
      <Outlet />
    </main>
  </div>
}
