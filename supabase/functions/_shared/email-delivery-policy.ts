export function emailDeliveryPolicy(mode: string, allowed?: string, sender?: string) {
  if (mode === 'test') {
    if (!allowed?.trim()) throw new Error('RESEND_ALLOWED_RECIPIENT_REQUIRED')
    return { recipient: allowed.trim().toLowerCase(), from: 'ITD336 <onboarding@resend.dev>' }
  }
  if (mode !== 'production' || !sender?.trim() || /@resend\.dev\b/i.test(sender)) {
    throw new Error('VERIFIED_DOMAIN_REQUIRED')
  }
  return { recipient: null, from: sender.trim() }
}
