import { useOutletContext } from 'react-router-dom'
import type { PublicLayoutContext } from './PublicLayout'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'
import './AccountSignInPrompt.css'

export function AccountSignInPrompt({ profile }: { profile: boolean }) {
  const { openSignIn } = useOutletContext<PublicLayoutContext>()
  return <section className="key-account-page public-account-sign-in">
    <PublicPageHeading title={profile ? 'โปรไฟล์ผู้ใช้' : 'การจองและกุญแจของฉัน'}
      description={profile ? 'ข้อมูลบัญชีมหาวิทยาลัยของคุณ' : 'ติดตามรายการจองห้องและสถานะการเบิกกุญแจ'} />
    <div className="account-sign-in-card">
      <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg>
      <p>กรุณาเข้าสู่ระบบเพื่อดูข้อมูลส่วนนี้</p>
      <button type="button" aria-label="เข้าสู่ระบบด้วยบัญชีมหาวิทยาลัย" onClick={openSignIn}>เข้าสู่ระบบ</button>
    </div>
  </section>
}
