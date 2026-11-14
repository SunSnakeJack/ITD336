export function emailDeliveryPolicy(mode: string, allowed?: string, sender?: string) {
  if (mode === 'test') {
    if (!allowed?.trim()) throw new Error('RESEND_ALLOWED_RECIPIENT_REQUIRED')
    const from = sender?.trim() || 'ITD336 <onboarding@resend.dev>'
    return { recipient: allowed.trim().toLowerCase(), from }
  }
  if (mode !== 'production' || !sender?.trim() || /@resend\.dev\b/i.test(sender)) {
    throw new Error('VERIFIED_DOMAIN_REQUIRED')
  }
  return { recipient: null, from: sender.trim() }
}

export function matchesTestRecipient(recipient: string, allowed: string) {
  return recipient.trim().toLowerCase() === allowed
}
