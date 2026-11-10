import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { NotificationBell } from '../../notifications/components/NotificationBell'
import { useState } from 'react'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { UserMenuDrawer } from './UserMenuDrawer'
import keySpaceLogo from '../../../assets/it-keyspace.ico'
import './KeyHeader.css'
import { AccountIdentitySummary } from './AccountIdentitySummary'

const publicLinks = [['/', 'ภาพรวม']]
const accountLinks = [['/account/requests', 'การจองและกุญแจ'], ['/account/history', 'ประวัติการใช้งาน']]

export function PublicLayout({ identity, loading, onLogout }: { identity: AuthIdentity | null; loading: boolean; onLogout: () => Promise<void> }) {
  const location=useLocation()
  const pathname=location.pathname
  const returnTo=`${pathname}${location.search}`
  const keyMode=pathname.startsWith('/keys')||pathname.startsWith('/account')
  const [menuOpen,setMenuOpen]=useState(false)
  const [loginOpen,setLoginOpen]=useState(false)
  const links = identity ? [...publicLinks, ...accountLinks] : publicLinks
  return <div className="student-shell public-shell">
    {!keyMode&&<aside className="public-sidebar"><Link className="public-brand" to="/"><img src="/images/logo-it-key.png" alt="ITD336" /></Link><small>พื้นที่ทำงาน · นักศึกษา</small><nav>{links.map(([to, label]) => <NavLink end={to === '/'} key={to} to={to}>{label}</NavLink>)}</nav></aside>}
    <div className="public-main">{keyMode?<header className="key-mobile-header"><Link className="key-header-logo" to="/keys"><img src={keySpaceLogo} alt="IT KeySpace" /></Link><div className="key-header-account"><NotificationBell/><button className="key-account-button" aria-label="เปิดเมนูผู้ใช้" onClick={()=>setMenuOpen(true)}><AccountIdentitySummary identity={identity}/></button></div></header>:<header><div className="public-account">{loading ? <small>กำลังตรวจสอบบัญชี…</small> : identity ? <><NotificationBell/><strong>{identity.fullName}</strong>{identity.role === 'ADMIN' && <Link className="header-link" to="/admin">ระบบผู้ดูแล</Link>}<button onClick={() => void onLogout()}>ออกจากระบบ</button></> : <Link className="header-link login-link" to="/login">เข้าสู่ระบบ</Link>}</div></header>}<main><Outlet /></main></div>
    {menuOpen&&<UserMenuDrawer identity={identity} onClose={()=>setMenuOpen(false)} onProfile={()=>{setMenuOpen(false);setLoginOpen(true)}} onLogout={onLogout}/>}
    {loginOpen&&<GoogleSsoModal returnTo={returnTo} onClose={()=>setLoginOpen(false)}/>}
  </div>
}
