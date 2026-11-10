import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'

const ProfileIcon=()=> <svg className="user-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
const HistoryIcon=()=> <svg className="user-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>
const HomeIcon=()=> <svg className="user-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>
const LogoutIcon=()=> <svg className="user-menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/></svg>

export function UserMenuDrawer({identity,onClose,onProfile,onLogout}:{identity:AuthIdentity|null;onClose:()=>void;onProfile:()=>void;onLogout:()=>Promise<void>}){
  return createPortal(<div className="user-menu-overlay" role="presentation" onClick={onClose}><aside className="user-menu-drawer" role="dialog" aria-label="เมนูผู้ใช้" onClick={(event)=>event.stopPropagation()}>
    <header><h2>เมนูผู้ใช้</h2><button aria-label="ปิดเมนู" onClick={onClose}>×</button></header>
    {identity&&<div className="user-menu-identity"><strong>{identity.fullName}</strong><small>{identity.email}</small></div>}
    <Link aria-label="หน้าหลัก" to="/keys" onClick={onClose}><HomeIcon/> หน้าหลัก</Link>
    {identity?<Link aria-label="โปรไฟล์ผู้ใช้" to="/account/profile" onClick={onClose}><ProfileIcon/> โปรไฟล์ผู้ใช้</Link>:<button aria-label="โปรไฟล์ผู้ใช้" onClick={onProfile}><ProfileIcon/> โปรไฟล์ผู้ใช้</button>}
    {identity?<Link aria-label="ประวัติการทำรายการ" to="/account/history" onClick={onClose}><HistoryIcon/> ประวัติการทำรายการ</Link>:<button aria-label="ประวัติการทำรายการ" onClick={onProfile}><HistoryIcon/> ประวัติการทำรายการ</button>}
    {identity&&<button className="user-menu-logout" onClick={()=>{onClose();void onLogout()}}><LogoutIcon/> ออกจากระบบ</button>}
  </aside></div>,document.body)
}
