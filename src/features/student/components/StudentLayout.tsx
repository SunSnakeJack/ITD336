import { NavLink, Outlet } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
export function StudentLayout({ identity, onLogout }: { identity: AuthIdentity; onLogout: () => Promise<void> }) { return <div className="student-shell"><header><NavLink to="/student/rooms"><img src="/images/logo-it-key.png" alt="ITD336" /></NavLink><nav><NavLink to="/student/rooms">เลือกห้อง</NavLink></nav><div><strong>{identity.fullName}</strong><button onClick={() => void onLogout()}>ออกจากระบบ</button></div></header><main><Outlet /></main></div> }
