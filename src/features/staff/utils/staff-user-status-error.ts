interface ResponseLike {
  json?: () => Promise<unknown>
  clone?: () => { json?: () => Promise<unknown> }
}

const messages: Record<string, string> = {
  LAST_ADMIN_REQUIRED: 'ไม่สามารถระงับผู้ดูแลระบบคนสุดท้ายได้',
  FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์เปลี่ยนสถานะผู้ใช้',
  AUTHENTICATION_REQUIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
}

export async function getStaffUserStatusErrorMessage(error: unknown): Promise<string> {
  try {
    const context = (error as { context?: ResponseLike } | null)?.context
    const response = typeof context?.json === 'function'
      ? context
      : typeof context?.clone === 'function'
        ? context.clone()
        : null
    const payload = typeof response?.json === 'function'
      ? await response.json() as { error?: unknown }
      : null
    const code = typeof payload?.error === 'string' ? payload.error : ''
    return messages[code] ?? 'ไม่สามารถเปลี่ยนสถานะบัญชีได้ กรุณาลองใหม่อีกครั้ง'
  } catch {
    return 'ไม่สามารถเปลี่ยนสถานะบัญชีได้ กรุณาลองใหม่อีกครั้ง'
  }
}
