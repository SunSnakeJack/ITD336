import { Link, Outlet, useLocation } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { NotificationBell } from '../../notifications/components/NotificationBell'
import { useState } from 'react'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { UserMenuDrawer } from './UserMenuDrawer'
import keySpaceLogo from '../../../assets/it-keyspace.ico'
import './KeyHeader.css'
import { AccountIdentitySummary } from './AccountIdentitySummary'

export function PublicLayout({ identity, loading, onLogout }: { identity: AuthIdentity | null; loading: boolean; onLogout: () => Promise<void> }) {
  const location=useLocation()
  const pathname=location.pathname
  const returnTo=`${pathname}${location.search}`
  const meetingRoomMode=pathname.startsWith('/meeting-room')
  const keyHeaderHome=meetingRoomMode?'/meeting-room':'/keys'
  const [menuOpen,setMenuOpen]=useState(false)
  const [loginOpen,setLoginOpen]=useState(false)
  return <div className="student-shell public-shell key-mode">
    <div className="public-main"><header className="key-mobile-header"><Link className="key-header-logo" to={keyHeaderHome}><img src={keySpaceLogo} alt="IT KeySpace" /></Link><div className="key-header-account">{loading?<small>กำลังตรวจสอบบัญชี…</small>:<><NotificationBell/><button className="key-account-button" aria-label="เปิดเมนูผู้ใช้" onClick={()=>setMenuOpen(true)}><AccountIdentitySummary identity={identity}/></button></>}</div></header><main><Outlet /></main></div>
    {menuOpen&&<UserMenuDrawer identity={identity} onClose={()=>setMenuOpen(false)} onProfile={()=>{setMenuOpen(false);setLoginOpen(true)}} onLogout={onLogout}/>}
    {loginOpen&&<GoogleSsoModal returnTo={returnTo} onClose={()=>setLoginOpen(false)}/>}
  </div>
}
