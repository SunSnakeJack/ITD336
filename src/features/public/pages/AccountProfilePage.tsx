import { Link } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { ROLE_LABELS } from '../../auth/auth.types'
import { AccountAvatar, PersonIcon } from '../components/AccountAvatar'
import './AccountProfilePage.css'

export function AccountProfilePage({ identity }: { identity: AuthIdentity }) {
  return <section className="key-account-page account-profile">
    <h1>โปรไฟล์ผู้ใช้</h1>
    <p>ข้อมูลบัญชีมหาวิทยาลัยของคุณ</p>
    <article className="account-profile-card">
      <header className="account-profile-hero">
        <div className="account-profile-avatar" data-testid="profile-person-icon">
          <AccountAvatar identity={identity} />
          <span className="account-profile-avatar-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="m2 9 10-5 10 5-10 5-10-5Zm5 4v4c3 2 7 2 10 0v-4l-5 2.5L7 13Zm13-2v6h1v-6Z"/></svg></span>
        </div>
        <h2>{identity.fullName}</h2>
        <small className="account-profile-role">{identity.role ? ROLE_LABELS[identity.role] : 'ยังไม่ได้กำหนดบทบาท'}</small>
      </header>
      <dl className="account-profile-details">
        <div>
          <span aria-hidden="true"><PersonIcon /></span>
          <dt>ชื่อ–นามสกุล</dt><dd>{identity.fullName}</dd>
        </div>
        <div>
          <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg></span>
          <dt>อีเมลมหาวิทยาลัย</dt><dd>{identity.email}</dd>
        </div>
      </dl>
    </article>
    <Link className="profile-history-action" to="/account/requests">การจองและกุญแจของฉัน</Link>
  </section>
}
