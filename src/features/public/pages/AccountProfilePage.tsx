import { Link } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { ROLE_LABELS } from '../../auth/auth.types'
import { PersonIcon } from '../components/AccountAvatar'

export function AccountProfilePage({identity}:{identity:AuthIdentity}){
 return <section className="key-account-page"><h1>โปรไฟล์ผู้ใช้</h1><p>ข้อมูลบัญชีมหาวิทยาลัยของคุณ</p><article className="key-profile-card"><span data-testid="profile-person-icon" aria-hidden="true"><PersonIcon/></span><h2>{identity.fullName}</h2><small>{identity.role?ROLE_LABELS[identity.role]:'ยังไม่ได้กำหนดบทบาท'} / บุคลากร</small><dl><div><dt>ชื่อ–นามสกุล</dt><dd>{identity.fullName}</dd></div><div><dt>อีเมลมหาวิทยาลัย</dt><dd>{identity.email}</dd></div></dl></article><Link className="primary-action profile-history-action" to="/account/history">ดูประวัติการทำรายการ</Link></section>
}
