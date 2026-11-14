import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { getStaffPageTitle, staffNavigation } from '../staff-navigation'
import '../staff.css'

export function StaffLayout({ identity, onLogout }: { identity: AuthIdentity; onLogout: () => Promise<void> }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const location = useLocation()
  const title = getStaffPageTitle(location.pathname)
  const dashboardActive = location.pathname === '/staff/usage-dashboard'
  const usersActive = location.pathname === '/staff/users'
  const roomsActive = location.pathname === '/staff/rooms'
  useEffect(() => { setDrawerOpen(false); setAccountOpen(false) }, [location.pathname])

  return <div className="staff-shell">
    <button className={`staff-backdrop ${drawerOpen ? 'is-open' : ''}`} aria-label="ปิดเมนูจากพื้นหลัง" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} />
    <aside className={`staff-sidebar ${drawerOpen ? 'is-open' : ''}`} data-testid="staff-sidebar">
      <div className="staff-brand">
        <img src="/images/logo-it-key.png" alt="ITD336" />
        <div><strong>ITD336</strong><small>Staff Management</small></div>
        <button className="staff-drawer-close" aria-label="ปิดเมนู" onClick={() => setDrawerOpen(false)}>×</button>
      </div>
      <nav aria-label="เมนูระบบเจ้าหน้าที่">
        {(['หลัก', 'จัดการ', 'ระบบ'] as const).map(group => <div className="staff-nav-group" key={group}><span className="staff-nav-label">{group}</span>{staffNavigation.filter(item => item.group === group).map((item) => <NavLink key={item.label} to={item.to} end={item.to === '/staff'} className={() => {
          const active = item.match ? location.pathname.startsWith(item.match) : item.to === '/staff' ? location.pathname === item.to : location.pathname.startsWith(item.to)
          return active ? 'active' : ''
        }}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}</div>)}
      </nav>
      <div className="staff-sidebar-account">
        {accountOpen && <div className="staff-sidebar-account-menu"><button type="button" aria-label="ออกจากระบบ" onClick={() => void onLogout()}>ออกจากระบบ</button></div>}
        <button className="staff-sidebar-foot" type="button" aria-label="เปิดเมนูบัญชี" aria-expanded={accountOpen} onClick={() => setAccountOpen(value => !value)}><span className="staff-sidebar-avatar" aria-hidden="true">{identity.fullName.slice(0, 2)}</span><span className="staff-sidebar-identity"><strong>{identity.fullName}</strong><em>ผู้ดูแลระบบ</em></span></button>
      </div>
    </aside>
    <div className="staff-workspace">
      <header className="staff-topbar" data-testid="staff-topbar">
        <button className="staff-menu-button" aria-label="เปิดเมนู" onClick={() => setDrawerOpen(true)}>☰</button>
        <div className="staff-topbar-title"><small>{dashboardActive ? 'USAGE DASHBOARD' : usersActive ? 'USER MANAGEMENT' : roomsActive ? 'ROOM OVERVIEW' : 'ระบบเจ้าหน้าที่'}</small><h1>{dashboardActive ? 'ภาพรวมการใช้งาน' : title}</h1></div>
        {roomsActive && <Link className="staff-topbar-export staff-topbar-add" to="/staff/rooms/new">+ เพิ่มห้องใหม่</Link>}
        {dashboardActive && <button className="staff-topbar-export" type="button" aria-label="Export PDF" onClick={() => window.print()}>⇩ Export PDF</button>}
        {usersActive && <Link className="staff-topbar-export staff-topbar-add" to="/staff/users?dialog=add">+ เพิ่มสมาชิกใหม่</Link>}
      </header>
      <main className="staff-main"><Outlet /></main>
    </div>
  </div>
}

