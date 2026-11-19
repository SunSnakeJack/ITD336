import { useId, useRef } from 'react'
import type { StaffRegisteredUser, StaffUserDirectoryItem } from '../types/staff-user.types'

type IconName = 'users' | 'check' | 'pause' | 'lock' | 'edit' | 'more' | 'warning' | 'trash'

export function StaffUserIcon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {name === 'users' && <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v1"/></>}
    {name === 'check' && <path d="m5 12 4 4 10-10"/>}
    {name === 'pause' && <path d="M9 5v14m6-14v14"/>}
    {name === 'lock' && <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>}
    {name === 'edit' && <path d="M4 20h4L20 8l-4-4L4 16v4Zm10-14 4 4"/>}
    {name === 'more' && <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth="3"/>}
    {name === 'warning' && <path d="M10.3 4.8a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3l7-12.2ZM12 9v4m0 3h.01"/>}
    {name === 'trash' && <path d="M4 7h16m-11 0V4h6v3M6 7l1 13h10l1-13m-8 4v5m4-5v5"/>}
  </svg>
}

const statuses = {
  ACTIVE: { label: 'เปิดใช้งาน', detail: 'เข้าสู่ระบบได้ตามปกติ', icon: 'check' },
  SUSPENDED: { label: 'ระงับบัญชี', detail: 'ไม่สามารถเข้าสู่ระบบได้', icon: 'pause' },
  INACTIVE: { label: 'ปิดใช้งาน', detail: 'ไม่สามารถเข้าสู่ระบบได้', icon: 'lock' },
  PENDING_REGISTRATION: { label: 'ยังไม่เข้าสู่ระบบ', detail: 'ยังไม่เคยลงชื่อเข้าใช้', icon: 'lock' },
} as const

export function StaffDirectoryStatus({ user }: { user: StaffUserDirectoryItem }) {
  const status = user.pendingRegistration ? 'PENDING_REGISTRATION' : user.accountStatus
  const { label, detail, icon } = statuses[status]
  return <span className="staff-directory-status" data-status={status}>
    <StaffUserIcon name={icon}/><span><strong>{label}</strong> – {detail}</span>
  </span>
}

export function StaffDirectoryActions({ user, onEdit, onStatus, onRemove }: {
  user: StaffUserDirectoryItem
  onEdit: (user: StaffRegisteredUser) => void
  onStatus: (user: StaffRegisteredUser, status: 'ACTIVE' | 'SUSPENDED') => void
  onRemove: (user: StaffUserDirectoryItem) => void
}) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const select = (action: () => void) => {
    menu.current?.hidePopover?.()
    action()
  }
  const name = user.fullName || user.email
  const active = !user.pendingRegistration && user.accountStatus === 'ACTIVE'
  const statusLabel = active ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'

  return <div className="staff-user-actions">
    {!user.pendingRegistration && <button type="button" className="staff-user-edit"
      aria-label={`แก้ไขข้อมูล ${name}`} onClick={() => onEdit(user)}>
      <StaffUserIcon name="edit"/>แก้ไข
    </button>}
    <button type="button" className="staff-user-more" aria-label={`จัดการบัญชี ${name}`} popoverTarget={id}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const popover = menu.current
        if (!popover) return
        popover.style.left = `${Math.max(8, bounds.right - 176)}px`
        if (window.innerHeight - bounds.bottom >= 100 || bounds.top < 100) {
          popover.style.top = `${bounds.bottom + 4}px`
          popover.style.bottom = 'auto'
        } else {
          popover.style.top = 'auto'
          popover.style.bottom = `${window.innerHeight - bounds.top + 4}px`
        }
      }}>
      <StaffUserIcon name="more"/>
    </button>
    <div className="staff-user-action-menu" id={id} popover="auto" ref={menu}>
      {!user.pendingRegistration && <button type="button" className={active ? 'suspend-user' : 'activate-user'}
        aria-label={`${statusLabel} ${name}`}
        onClick={() => select(() => onStatus(user, active ? 'SUSPENDED' : 'ACTIVE'))}>
        <StaffUserIcon name={active ? 'warning' : 'check'}/>{statusLabel}
      </button>}
      <button type="button" className="remove-user" aria-label={`ลบผู้ใช้ ${name}`}
        onClick={() => select(() => onRemove(user))}><StaffUserIcon name="trash"/>ลบผู้ใช้</button>
    </div>
  </div>
}
