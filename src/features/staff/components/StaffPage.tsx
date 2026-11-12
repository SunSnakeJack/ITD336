import type { ReactNode } from 'react'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

export function StaffPage({ eyebrow, title, description, actions, children }: { eyebrow: string; title: string; description: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="staff-page"><header className="staff-page-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{actions && <div className="staff-page-actions">{actions}</div>}</header>{children}</section>
}

export function StaffQueryState({ loading, error, empty, emptyText, children }: { loading: boolean; error: Error | null; empty?: boolean; emptyText?: string; children: ReactNode }) {
  if (loading) return <LoadingSpinner label="กำลังโหลดข้อมูล…" />
  if (error) return <div className="staff-state staff-state-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลได้</strong><p>กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบหากปัญหายังคงอยู่</p></div>
  if (empty) return <div className="staff-state"><strong>ยังไม่มีข้อมูล</strong><p>{emptyText ?? 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข'}</p></div>
  return children
}

export function BackendLimitation({ title, children }: { title: string; children: ReactNode }) {
  return <div className="staff-limitation" role="note"><span aria-hidden="true">!</span><div><strong>{title}</strong><p>{children}</p></div></div>
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { ACTIVE: 'เปิดใช้งาน', SUSPENDED: 'ระงับบัญชี', INACTIVE: 'ปิดใช้งาน', PENDING: 'รออนุมัติ', REQUESTED: 'รอดำเนินการ', APPROVED: 'อนุมัติแล้ว', REJECTED: 'ไม่อนุมัติ', CANCELLED: 'ยกเลิก', CHECKED_OUT: 'กำลังถือกุญแจ', RETURN_REPORTED: 'รอตรวจรับ', RETURNED: 'คืนแล้ว', COMPLETED: 'เสร็จสิ้น', IN_USE: 'กำลังใช้งาน', LATE: 'เกินกำหนด', LOST: 'สูญหาย', DAMAGED: 'ชำรุด', NO_SHOW: 'ไม่มาใช้งาน', SUPERSEDED: 'ถูกแทนที่' }
  return <span className={`staff-badge staff-badge-${status.toLowerCase()}`}>{labels[status] ?? status}</span>
}
