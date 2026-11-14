import { describe, expect, it } from 'vitest'
import { emailDeliveryPolicy, matchesTestRecipient } from '../../../supabase/functions/_shared/email-delivery-policy'
import { renderKeyRequestEmail } from '../../../supabase/functions/_shared/email-templates'

describe('email delivery policy', () => {
  it('uses the verified sender in test mode while enforcing one allowed recipient', () => {
    const sender = 'ITD336 <noreply@itd336.app>'
    expect(emailDeliveryPolicy('test', ' TEST@example.com ', sender)).toEqual({ from: sender, recipient: 'test@example.com' })
    expect(matchesTestRecipient('TEST@example.com', 'test@example.com')).toBe(true)
    expect(matchesTestRecipient('other@example.com', 'test@example.com')).toBe(false)
    expect(matchesTestRecipient('test@example.com,other@example.com', 'test@example.com')).toBe(false)
  })
  it('restricts test delivery and requires a production sender', () => {
    expect(emailDeliveryPolicy('test', ' TEST@example.com ')).toMatchObject({ recipient: 'test@example.com' })
    expect(() => emailDeliveryPolicy('production')).toThrow('VERIFIED_DOMAIN_REQUIRED')
    expect(() => emailDeliveryPolicy('production', undefined, 'IT <onboarding@resend.dev>')).toThrow()
    expect(emailDeliveryPolicy('production', undefined, 'IT <mail@example.com>')).toMatchObject({ recipient: null })
  })
  it('renders admin notices without borrower action links', () => {
    const rendered = renderKeyRequestEmail('key-request-admin-notice', { requestCode: 'K1', roomName: '<Room>', startsAt: '2026-11-13T03:00:00Z', endsAt: '2026-11-13T04:00:00Z', purpose: 'เรียน', status: 'PENDING_APPROVAL', links: { track: '', cancel: 'https://example.com/cancel', returnKey: '' } })
    expect(rendered.subject).toBe('มีคำขอใช้ห้องรออนุมัติ')
    expect(rendered.html).toContain('&lt;Room&gt;')
    expect(rendered.html).not.toContain('https://example.com/cancel')
  })
})
