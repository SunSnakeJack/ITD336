import { Link, Outlet, useLocation } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { NotificationBell } from '../../notifications/components/NotificationBell'
import { useEffect, useRef, useState } from 'react'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { UserMenuDrawer } from './UserMenuDrawer'
import keySpaceLogo from '../../../assets/it-keyspace.ico'
import './KeyHeader.css'
import './RoomServiceTheme.css'
import { AccountIdentitySummary } from './AccountIdentitySummary'
import { useQuery } from '@tanstack/react-query'
import { publicNavigationQuery, type NavigationMode } from '../public-navigation.queries'
import { PublicBottomNav } from './PublicBottomNav'
import { PersonIcon } from './AccountAvatar'
import './PublicNavigation.css'
import { publicMenuRoot, rememberPublicMenu, rememberedPublicMenu } from '../public-navigation-memory'
import { usePublicScrollPosition } from '../usePublicScrollPosition'

export interface PublicLayoutContext {
  navigationMode: NavigationMode
  navigationLoading: boolean
  openSignIn: () => void
  onLogout: () => Promise<void>
}

export function PublicLayout({ identity, loading, onLogout }: { identity: AuthIdentity | null; loading: boolean; onLogout: () => Promise<void> }) {
  const location=useLocation()
  const pathname=location.pathname
  const returnTo=`${pathname}${location.search}${location.hash}`
  const meetingRoomMode=pathname.startsWith('/meeting-room')
  const [menuOpen,setMenuOpen]=useState(false)
  const [loginOpen,setLoginOpen]=useState(false)
  const roomServiceMode = /^\/(keys|meeting-room)(\/|$)/.test(pathname)
  const navigation = useQuery(publicNavigationQuery())
  const navigationMode = navigation.data ?? 'top'
  const scope = identity?.userId ?? 'guest'
  const currentRoot = publicMenuRoot(pathname)
  const content = useRef<HTMLElement>(null)
  usePublicScrollPosition(!loading && currentRoot ? `page-scroll:${scope}:${returnTo}` : undefined, content)
  useEffect(() => {
    if (!loading && currentRoot) rememberPublicMenu(scope, currentRoot, returnTo)
  }, [loading, currentRoot, scope, returnTo])
  const destination = (root: string) => currentRoot === root ? returnTo : rememberedPublicMenu(scope, root)
  const logout = async () => { await onLogout(); setMenuOpen(false) }
  const keyHeaderHome = meetingRoomMode ? '/meeting-room' : '/keys'
  const hasBottomNav = navigationMode !== 'top'
  const context: PublicLayoutContext = { navigationMode, navigationLoading: navigation.isPending, openSignIn: () => setLoginOpen(true), onLogout: logout }
  return <div className={`student-shell public-shell key-mode${roomServiceMode ? ' room-service-theme' : ''}${hasBottomNav ? ' has-bottom-nav' : ''}${navigationMode === 'both' ? ' public-navigation-combined' : ''}`}>
    <div className="public-main">
      {navigationMode !== 'bottom' && <header className="key-mobile-header public-wave-header">
        <Link className="key-header-logo" to={keyHeaderHome}><img src={keySpaceLogo} alt="IT KeySpace" /></Link>
        <div className="key-header-account">{loading ? <small>กำลังตรวจสอบบัญชี…</small> : !identity
          ? <button className="public-header-sign-in" type="button" onClick={context.openSignIn}><PersonIcon />เข้าสู่ระบบ</button>
          : <>
          <NotificationBell />
          <div className="public-account-dropdown" onBlur={event => {
            if (navigationMode === 'both' && !event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false)
          }} onKeyDown={event => { if (event.key === 'Escape') setMenuOpen(false) }}>
            <button className="key-account-button" aria-label="เปิดเมนูผู้ใช้" aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}>
              <AccountIdentitySummary identity={identity} />
            </button>
            {navigationMode === 'both' && identity && menuOpen &&
              <button type="button" className="public-account-logout" onClick={() => void logout()}>ออกจากระบบ</button>}
          </div>
        </>}</div>
      </header>}
      <main ref={content}><Outlet context={context} /></main>
    </div>
    {hasBottomNav && <PublicBottomNav pathname={pathname} combined={navigationMode === 'both'} destination={destination} />}
    {navigationMode === 'top' && menuOpen && <UserMenuDrawer identity={identity} destination={destination} onClose={()=>setMenuOpen(false)} onProfile={()=>{setMenuOpen(false);setLoginOpen(true)}} onLogout={logout}/>}
    {loginOpen&&<GoogleSsoModal returnTo={returnTo} onClose={()=>setLoginOpen(false)}/>}
  </div>
}
