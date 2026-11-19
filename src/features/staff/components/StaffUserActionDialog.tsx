import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import type { StaffUserDirectoryItem } from '../types/staff-user.types'
import { getStaffInitials } from '../utils/staff-user-directory'
import { StaffUserIcon } from './StaffUserDirectoryControls'

const copy = {
  SUSPENDED: ['ระงับบัญชีผู้ใช้', 'คุณต้องการระงับบัญชีของผู้ใช้นี้ใช่หรือไม่?', 'ผู้ใช้จะไม่สามารถเข้าสู่ระบบหรือใช้งานระบบได้ชั่วคราว', 'ยืนยันการระงับ'],
  ACTIVE: ['เปิดใช้งานบัญชี', 'คุณต้องการเปิดใช้งานบัญชีนี้ใช่หรือไม่?', 'ผู้ใช้จะกลับเข้าสู่ระบบได้ตามปกติ', 'เปิดใช้งาน'],
  INACTIVE: ['ปิดใช้งานบัญชี', 'คุณต้องการปิดใช้งานบัญชีนี้ใช่หรือไม่?', 'ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้ โดยระบบจะเก็บประวัติการใช้งานไว้', 'ยืนยันการปิดใช้งาน'],
} as const

export function StaffUserActionDialog({ user, action, pending, error, onClose, onConfirm }: {
  user: StaffUserDirectoryItem
  action: keyof typeof copy | 'REMOVE'
  pending: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}) {
  const removing = action === 'REMOVE'
  const [title, message, detail, confirmLabel] = removing ? [
    'ลบผู้ใช้',
    'คุณต้องการลบผู้ใช้นี้ใช่หรือไม่?',
    user.pendingRegistration
      ? 'ผู้ใช้จะถูกนำออกจากรายชื่อที่กำหนดสิทธิ์ล่วงหน้า'
      : 'ผู้ใช้จะถูกปิดสิทธิ์เข้าใช้งานและนำออกจากรายชื่อ โดยระบบจะเก็บประวัติการใช้งานไว้',
    'ลบผู้ใช้',
  ] : copy[action]
  const tone = removing ? 'remove' : action === 'ACTIVE' ? 'activate' : 'warning'
  return <ConfirmDialog
    title={title} message={message} confirmLabel={confirmLabel} danger={removing}
    className={`staff-user-confirm staff-user-confirm-${tone}`}
    icon={<div className="staff-user-confirm-icon"><StaffUserIcon name={removing ? 'trash' : action === 'ACTIVE' ? 'check' : 'warning'}/></div>}
    pending={pending} error={error} onClose={onClose} onConfirm={onConfirm}
  >
    <div className="staff-user-confirm-detail">{detail}</div>
    <div className="staff-user-confirm-account">
      <span aria-hidden="true">{getStaffInitials(user.fullName)}</span>
      <div><strong>{user.fullName || 'ยังไม่มีชื่อ'}</strong><small>{user.email}</small></div>
    </div>
    {removing && <div className="staff-user-removal-warning"><StaffUserIcon name="warning"/>กรุณาตรวจสอบบัญชีก่อนยืนยันการลบ</div>}
  </ConfirmDialog>
}
