import { Navigate, useOutletContext } from 'react-router-dom'
import type { PublicLayoutContext } from '../components/PublicLayout'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'

export function PublicDashboardPage() {
  const { navigationMode, navigationLoading } = useOutletContext<PublicLayoutContext>()
  if (navigationLoading) return null
  if (navigationMode !== 'both') return <Navigate to="/keys" replace />
  return <section className="key-account-page public-dashboard"><PublicPageHeading title="ตารางการใช้ห้อง" /></section>
}
