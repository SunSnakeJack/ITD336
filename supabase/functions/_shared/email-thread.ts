export function requestEmailSubject(entity: string, requestCode: string) {
  const label = entity === 'booking' ? 'การจองห้อง' : 'คำขอเบิกกุญแจ'
  return `IT KeySpace | ${label} ${requestCode.trim().replace(/[\r\n]+/g, ' ')}`
}

export async function requestEmailThreadHeaders(
  entity: string,
  entityId: string,
  recipient: string,
  previousMessageId?: string,
): Promise<Record<string, string>> {
  const key = JSON.stringify([entity, entityId, recipient.trim().toLowerCase()])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const reference = `<${hex}@threads.itd336.app>`
  if (previousMessageId && /^<[^\s<>]+@[^\s<>]+>$/.test(previousMessageId)) {
    return { 'In-Reply-To': previousMessageId, References: `${reference} ${previousMessageId}` }
  }
  return { References: reference }
}
