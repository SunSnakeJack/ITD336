export const serviceRoles = ['STUDENT', 'TEACHER', 'DEAN', 'DEPARTMENT_HEAD', 'STAFF', 'ADMIN'] as const
export const servicePermissionRows = [
  ['KEY_REQUEST_GENERAL', 'เบิกกุญแจห้องทั่วไป'],
  ['KEY_REQUEST_SPECIAL', 'เบิกกุญแจห้องพิเศษ'],
  ['MEETING_BOOK', 'จองห้องประชุม'],
  ['BOOKING_OVERRIDE', 'จองทับตามสิทธิ์'],
  ['STAFF_ACCESS', 'เข้าถึงระบบแอดมิน'],
] as const

export function defaultServiceGrant(role: typeof serviceRoles[number], permission: string) {
  if (role === 'ADMIN' || permission === 'KEY_REQUEST_GENERAL' || permission === 'KEY_REQUEST_SPECIAL') return true
  if (permission === 'MEETING_BOOK') return ['TEACHER', 'DEAN', 'DEPARTMENT_HEAD'].includes(role)
  if (permission === 'BOOKING_OVERRIDE') return ['DEAN', 'DEPARTMENT_HEAD'].includes(role)
  return permission === 'STAFF_ACCESS' && role === 'STAFF'
}
