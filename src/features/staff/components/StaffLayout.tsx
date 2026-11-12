import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { getStaffPageTitle, staffNavigation } from '../staff-navigation'
import '../staff.css'

export function StaffLayout({ identity, onLogout }: { identity: AuthIdentity; onLogout: () => Promise<void> }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const title = getStaffPageTitle(location.pathname)

  useEffect(() => setDrawerOpen(false), [location.pathname])

  return <div className="staff-shell">
    <button className={`staff-backdrop ${drawerOpen ? 'is-open' : ''}`} aria-label="ปิดเมนูจากพื้นหลัง" tabIndex={drawerOpen ? 0 : -1} onClick={() => setDrawerOpen(false)} />
    <aside className={`staff-sidebar ${drawerOpen ? 'is-open' : ''}`} data-testid="staff-sidebar">
      <div className="staff-brand">
        <img src="/images/logo-it-key.png" alt="ITD336" />
        <div><strong>ITD336</strong><small>Staff Management</small></div>
        <button className="staff-drawer-close" aria-label="ปิดเมนู" onClick={() => setDrawerOpen(false)}>×</button>
      </div>
      <nav aria-label="เมนูระบบเจ้าหน้าที่">
        {staffNavigation.map((item) => <NavLink key={item.label} to={item.to} end={item.to === '/staff'} className={() => {
          const active = item.match ? location.pathname.startsWith(item.match) : item.to === '/staff' ? location.pathname === item.to : location.pathname.startsWith(item.to)
          return active ? 'active' : ''
        }}><span aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}
      </nav>
      <div className="staff-sidebar-foot"><span>สิทธิ์ปัจจุบัน</span><strong>ผู้ดูแลระบบ</strong><Link to="/admin">ไปยังระบบ Admin เดิม</Link></div>
    </aside>
    <div className="staff-workspace">
      <header className="staff-topbar">
        <button className="staff-menu-button" aria-label="เปิดเมนู" onClick={() => setDrawerOpen(true)}>☰</button>
        <div className="staff-title"><small><Link to="/staff">ระบบเจ้าหน้าที่</Link> / {title}</small><h1>{title}</h1></div>
        <div className="staff-account"><span><strong>{identity.fullName}</strong><small>{identity.email}</small></span><button onClick={() => void onLogout()}>ออกจากระบบ</button></div>
      </header>
      <main className="staff-main"><Outlet /></main>
    </div>
  </div>
}

