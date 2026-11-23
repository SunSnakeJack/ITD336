import { describe, expect, it } from 'vitest'
import { accountBookingStatus, accountKeyLoanStatus, accountKeyRequestStatus } from './account-request-status'

const now = Date.parse('2026-11-19T17:00:00+07:00')
const end = '2026-11-19T17:30:00+07:00'

describe('account request status badges', () => {
  it('uses the completed badge for an approved booking at its end time', () => {
    expect(accountBookingStatus('APPROVED', end, now)).toEqual({ label: 'อนุมัติแล้ว', tone: 'green' })
    expect(accountBookingStatus('APPROVED', end, Date.parse(end))).toEqual({ label: 'สิ้นสุดแล้ว', tone: 'gray' })
    expect(accountBookingStatus('SUPERSEDED', end, now).tone).toBe('purple')
  })

  it('marks returnable key requests overdue at the end time', () => {
    expect(accountKeyRequestStatus('PENDING_APPROVAL', end, now).tone).toBe('amber')
    expect(accountKeyRequestStatus('APPROVED', end, Date.parse(end), true)).toEqual({ label: 'เกินกำหนด', tone: 'red' })
    expect(accountKeyRequestStatus('IN_USE', end, Date.parse(end), true).tone).toBe('red')
    expect(accountKeyRequestStatus('APPROVED', end, Date.parse(end), false).tone).toBe('gray')
    expect(accountKeyRequestStatus('RETURNED', end, Date.parse(end), false).tone).toBe('green')
    expect(accountKeyRequestStatus('REJECTED', end, now).tone).toBe('red')
  })

  it('distinguishes a key on loan, due soon, and returned early', () => {
    expect(accountKeyLoanStatus({ status: 'CHECKED_OUT', expectedReturnAt: end }, now - 1).tone).toBe('blue')
    expect(accountKeyLoanStatus({ status: 'CHECKED_OUT', expectedReturnAt: end }, now)).toEqual({ label: 'ใกล้ถึงกำหนด', tone: 'orange' })
    expect(accountKeyLoanStatus({ status: 'RETURNED', expectedReturnAt: end, returnedAt: new Date(now).toISOString() }, now))
      .toEqual({ label: 'คืนก่อนกำหนด', tone: 'green' })
  })
})
