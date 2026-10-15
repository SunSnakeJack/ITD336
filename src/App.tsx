import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { AuthenticatedRoleView } from './features/auth/components/AuthenticatedRoleView'
import { LoginForm } from './features/auth/components/LoginForm'
import { useAuthSession } from './features/auth/hooks/useAuthSession'
import type { AuthIdentity } from './features/auth/auth.types'
import { AdminLayout } from './features/admin/components/AdminLayout'
import { AdminDashboardPage } from './features/admin/pages/AdminDashboardPage'
import { AcademicSchedulesPage } from './features/admin/pages/AcademicSchedulesPage'
import { AdminRoomSchedulePage } from './features/admin/pages/AdminRoomSchedulePage'
import { RoomsManagementPage } from './features/admin/pages/RoomsManagementPage'
import { AdminRoomDetailPage } from './features/admin/pages/AdminRoomDetailPage'
import { AcademicTermsPage } from './features/admin/pages/AcademicTermsPage'
import { AdminPlaceholderPage } from './features/admin/pages/AdminPlaceholderPage'
import { PublicLayout } from './features/public/components/PublicLayout'
import { RoomSelectionPage } from './features/student/pages/RoomSelectionPage'
import { RoomDetailPage } from './features/student/pages/RoomDetailPage'

function AdminGuard({ identity, loading, children }: { identity: AuthIdentity | null; loading: boolean; children: ReactNode }) {
  if (loading) return <main className="session-loading" aria-live="polite">กำลังตรวจสอบสิทธิ์…</main>
  return identity?.role === 'ADMIN' ? children : <Navigate to="/login" replace />
}

function LegacyRoomRedirect() {
  const { roomId } = useParams()
  return <Navigate to={roomId ? `/rooms/${roomId}` : '/'} replace />
}

export function App() {
  const { identity, loading, error, logout } = useAuthSession()
  const loginDestination = identity?.role === 'ADMIN' ? '/admin' : identity ? '/account' : null

  return <Routes>
    <Route element={<PublicLayout identity={identity} loading={loading} onLogout={logout} />}><Route index element={<RoomSelectionPage />} /><Route path="rooms/:roomId" element={<RoomDetailPage />} /></Route>
    <Route path="login" element={loading ? <main className="session-loading">กำลังตรวจสอบบัญชี…</main> : loginDestination ? <Navigate to={loginDestination} replace /> : <>{error && <div className="session-message" role="status">{error}</div>}<LoginForm /></>} />
    <Route path="admin" element={<AdminGuard identity={identity} loading={loading}><AdminLayout identity={identity as AuthIdentity} onLogout={logout} /></AdminGuard>}><Route index element={<AdminDashboardPage />} /><Route path="rooms" element={<RoomsManagementPage />} /><Route path="rooms/:roomId" element={<AdminRoomDetailPage />} /><Route path="terms" element={<AcademicTermsPage />} /><Route path="academic-schedules" element={<AcademicSchedulesPage />} /><Route path="room-schedule" element={<AdminRoomSchedulePage />} /><Route path="users" element={<AdminPlaceholderPage title="จัดการผู้ใช้งาน" />} /><Route path="bookings" element={<AdminPlaceholderPage title="จัดการการจอง" />} /></Route>
    <Route path="account" element={loading ? <main className="session-loading">กำลังตรวจสอบบัญชี…</main> : identity ? <AuthenticatedRoleView identity={identity} onLogout={logout} /> : <Navigate to="/login" replace />} />
    <Route path="student/rooms" element={<Navigate to="/" replace />} /><Route path="student/rooms/:roomId" element={<LegacyRoomRedirect />} /><Route path="student/schedule" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
