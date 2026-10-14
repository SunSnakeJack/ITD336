import { AuthenticatedRoleView } from './features/auth/components/AuthenticatedRoleView'
import { LoginForm } from './features/auth/components/LoginForm'
import { useAuthSession } from './features/auth/hooks/useAuthSession'

export function App() {
  const { identity, loading, error, logout } = useAuthSession()

  if (loading) {
    return <main className="session-loading" aria-live="polite">กำลังตรวจสอบการเข้าสู่ระบบ…</main>
  }

  if (identity) return <AuthenticatedRoleView identity={identity} onLogout={logout} />

  return (
    <>
      {error && <div className="session-message" role="status">{error}</div>}
      <LoginForm />
    </>
  )
}
