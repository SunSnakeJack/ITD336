import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'

export const auditActions = [
  { label: 'เบิกกุญแจ', codes: ['KEY_REQUESTED', 'KEY_REQUEST_CREATED', 'KEY_REQUEST_AUTO_APPROVED', 'CLASS_KEY_REQUEST_AUTO_APPROVED', 'KEY_BORROWED', 'KEY_CHECKED_OUT'] },
  { label: 'คืนกุญแจ', codes: ['KEY_REQUEST_RETURNED', 'KEY_RETURN_REPORTED', 'KEY_RETURN_VERIFIED', 'KEY_RETURNED'] },
  { label: 'ยกเลิก', codes: ['KEY_REQUEST_CANCELLED', 'KEY_REQUEST_TOKEN_CANCEL', 'BOOKING_CANCELLED'] },
  { label: 'แก้ไขข้อมูลผู้ใช้', codes: ['ADMIN_USER_PROFILE_UPDATED', 'USER_ROLES_UPDATED', 'USER_ACCOUNT_STATUS_UPDATED'] },
  { label: 'จัดการผู้ใช้', codes: ['USER_INVITED', 'USER_PREASSIGNED', 'USER_PREASSIGNMENT_REMOVED', 'USER_REMOVED'] },
  { label: 'จัดการบทบาท', codes: ['ROLE_LABEL_CREATE', 'ROLE_LABEL_RENAME', 'ROLE_LABEL_DELETE'] },
  { label: 'จองห้อง', codes: ['BOOKING_CREATED', 'MEETING_BOOKING_CREATED', 'EXTERNAL_BOOKING_CREATED'] },
  { label: 'อนุมัติรายการ', codes: ['BOOKING_APPROVED', 'KEY_REQUEST_APPROVED'] },
  { label: 'ไม่อนุมัติรายการ', codes: ['BOOKING_REJECTED', 'KEY_REQUEST_REJECTED'] },
  { label: 'แก้ไขรายการ', codes: ['REQUEST_UPDATED', 'REQUEST_PURPOSE_UPDATED'] },
]

const thBangkok = { timeZone: 'Asia/Bangkok' } as const
const date = new Intl.DateTimeFormat('en-GB', { ...thBangkok, day: '2-digit', month: '2-digit', year: '2-digit' })
const time = new Intl.DateTimeFormat('en-GB', { ...thBangkok, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export function formatAuditTime(value: string) {
  const instant = new Date(value)
  return `${date.format(instant)} ${time.format(instant)}`
}

export type AuditActor = 'ADMIN' | 'USER'
interface AuditRow {
  id: string
  createdAt: string
  actorName: string | null
  actorKind: AuditActor | 'SYSTEM' | null
  actorKindEstimated?: boolean
  action: string
  entityType: string
  entityId: string | null
  reference: string | null
  detail: string | null
  ip: string | null
}

export function auditActionLabel(code: string) {
  const exact: Record<string, string> = {
    ROLE_LABEL_CREATE: 'เพิ่มบทบาท', ROLE_LABEL_RENAME: 'แก้ไขบทบาท', ROLE_LABEL_DELETE: 'ลบบทบาท',
    USER_PREASSIGNED: 'เพิ่มผู้ใช้', USER_REMOVED: 'ลบผู้ใช้', USER_PREASSIGNMENT_REMOVED: 'ลบรายชื่อผู้ใช้',
  }
  return exact[code] ?? auditActions.find(item => item.codes.includes(code))?.label ?? code
}

export const auditLogKeys = ['staff', 'audit-logs'] as const
export function staffAuditQuery(actor: AuditActor | null, action: string, page: number, search = '') {
  const term = search.trim()
  return queryOptions({
    queryKey: [...auditLogKeys, actor, action, page, term],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_staff_audit_logs_search' as never, {
        p_actor: actor, p_actions: auditActions.find(item => item.label === action)?.codes ?? null, p_page: page,
        p_search: term || null,
      } as never)
      if (error) throw new Error('ไม่สามารถโหลดบันทึกกิจกรรมได้')
      return data as { total: number; rows: AuditRow[] }
    },
  })
}
