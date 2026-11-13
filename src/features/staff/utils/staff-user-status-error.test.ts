import { describe, expect, it } from 'vitest'
import { getStaffUserStatusErrorMessage } from './staff-user-status-error'

describe('staff user status errors', () => {
  it('falls back safely when the function context is not a Response', async () => {
    const error = { message: 'Edge Function returned a non-2xx status code', context: { status: 500 } }
    await expect(getStaffUserStatusErrorMessage(error)).resolves.toBe('ไม่สามารถเปลี่ยนสถานะบัญชีได้ กรุณาลองใหม่อีกครั้ง')
  })

  it('translates known errors from a response-like context', async () => {
    const error = { context: { json: async () => ({ error: 'LAST_ADMIN_REQUIRED' }) } }
    await expect(getStaffUserStatusErrorMessage(error)).resolves.toBe('ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายได้')
  })

  it('supports cloned responses from older function clients', async () => {
    const error = { context: { clone: () => ({ json: async () => ({ error: 'FORBIDDEN' }) }) } }
    await expect(getStaffUserStatusErrorMessage(error)).resolves.toBe('บัญชีนี้ไม่มีสิทธิ์เปลี่ยนสถานะผู้ใช้')
  })
})
