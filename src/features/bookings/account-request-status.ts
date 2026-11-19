import type { KeyLoanDetail, KeyLoanStatus } from '../keys/key.types'
import { effectiveBookingStatus } from './booking-status.utils'
import type { BookingStatus } from './booking.types'

export type AccountRequestStatus = {
  label: string
  tone: 'amber' | 'green' | 'blue' | 'orange' | 'red' | 'gray' | 'purple'
}

const pending: AccountRequestStatus = { label: 'รออนุมัติ', tone: 'amber' }
const rejected: AccountRequestStatus = { label: 'ไม่อนุมัติ', tone: 'red' }
const cancelled: AccountRequestStatus = { label: 'ยกเลิก', tone: 'gray' }
const inUse: AccountRequestStatus = { label: 'กำลังใช้งาน', tone: 'blue' }
const completed: AccountRequestStatus = { label: 'สิ้นสุดแล้ว', tone: 'gray' }

const bookingStatuses: Record<BookingStatus, AccountRequestStatus> = {
  PENDING: pending,
  APPROVED: { label: 'อนุมัติแล้ว', tone: 'green' },
  REJECTED: rejected,
  CANCELLED: cancelled,
  IN_USE: inUse,
  COMPLETED: completed,
  NO_SHOW: { label: 'ไม่มาใช้งาน', tone: 'orange' },
  SUPERSEDED: { label: 'ถูกแทนที่', tone: 'purple' },
}

const keyRequestStatuses = new Map<string, AccountRequestStatus>([
  ['PENDING_APPROVAL', pending],
  ['APPROVED', { label: 'จองสำเร็จ', tone: 'green' }],
  ['IN_USE', inUse],
  ['RETURNED', { label: 'คืนแล้ว', tone: 'green' }],
  ['CANCELLED', { label: 'ยกเลิกแล้ว', tone: 'gray' }],
  ['REJECTED', rejected],
])

const keyLoanStatuses: Record<KeyLoanStatus, AccountRequestStatus> = {
  REQUESTED: pending,
  APPROVED: { label: 'พร้อมรับกุญแจ', tone: 'green' },
  REJECTED: rejected,
  CHECKED_OUT: { label: 'เบิกแล้ว', tone: 'blue' },
  RETURN_REPORTED: { label: 'แจ้งคืนแล้ว', tone: 'blue' },
  RETURNED: { label: 'คืนเรียบร้อย', tone: 'green' },
  LATE: { label: 'เกินกำหนด', tone: 'red' },
  LOST: { label: 'สูญหาย', tone: 'red' },
  DAMAGED: { label: 'ชำรุด', tone: 'orange' },
  CANCELLED: cancelled,
}

export function accountBookingStatus(status: BookingStatus, endsAt: string, now = Date.now()): AccountRequestStatus {
  return bookingStatuses[effectiveBookingStatus(status, endsAt, now)] ?? { label: status, tone: 'gray' }
}

export function accountKeyRequestStatus(status: string, endsAt: string, now = Date.now()): AccountRequestStatus {
  if (status === 'APPROVED' && Date.parse(endsAt) <= now) return completed
  return keyRequestStatuses.get(status) ?? { label: status, tone: 'gray' }
}

export function accountKeyLoanStatus(
  { status, expectedReturnAt, returnedAt }: Partial<Pick<KeyLoanDetail, 'expectedReturnAt' | 'returnedAt'>> & Pick<KeyLoanDetail, 'status'>,
  now = Date.now(),
): AccountRequestStatus {
  const dueAt = expectedReturnAt ? Date.parse(expectedReturnAt) : NaN
  const remaining = dueAt - now
  if (status === 'CHECKED_OUT' && remaining > 0 && remaining <= 30 * 60_000) {
    return { label: 'ใกล้ถึงกำหนด', tone: 'orange' }
  }
  if (status === 'RETURNED' && returnedAt && Date.parse(returnedAt) < dueAt) {
    return { label: 'คืนก่อนกำหนด', tone: 'green' }
  }
  return keyLoanStatuses[status] ?? { label: status, tone: 'gray' }
}
