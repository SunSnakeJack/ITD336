export type RoleCode = 'STUDENT' | 'TEACHER' | 'STAFF' | 'ADMIN' | 'PRIORITY_USER'

export interface AuthIdentity {
  userId: string
  fullName: string
  email: string
  role: RoleCode
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  STUDENT: 'นักศึกษา',
  TEACHER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
  PRIORITY_USER: 'ผู้ใช้งานที่ได้รับสิทธิ์พิเศษ',
}
