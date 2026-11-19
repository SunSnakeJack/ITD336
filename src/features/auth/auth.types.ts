export const priorityRoles = ['DEAN', 'DEPARTMENT_HEAD', 'PRIORITY_USER'] as const
export type RoleCode = 'STUDENT' | 'TEACHER' | 'STAFF' | 'ADMIN' | typeof priorityRoles[number]

export interface AuthIdentity {
  userId: string
  fullName: string
  givenName?: string
  email: string
  role: RoleCode | null
  roles?: readonly RoleCode[]
  avatarUrl?: string
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  STUDENT: 'นักศึกษา',
  TEACHER: 'อาจารย์',
  STAFF: 'เจ้าหน้าที่',
  ADMIN: 'ผู้ดูแลระบบ',
  PRIORITY_USER: 'คณบดีและหัวหน้าสาขา',
  DEAN: 'คณบดี',
  DEPARTMENT_HEAD: 'หัวหน้าสาขา',
}

export function hasPriorityRole(identity: AuthIdentity | null) {
  return priorityRoles.some(role => identity?.role === role || identity?.roles?.includes(role))
}

export function getRequesterStatus(identity: AuthIdentity | null): 'TEACHER' | 'STUDENT' | undefined {
  const roles = identity?.roles ?? (identity?.role ? [identity.role] : [])
  if (hasPriorityRole(identity) || roles.includes('TEACHER')) return 'TEACHER'
  if (roles.includes('STUDENT')) return 'STUDENT'
}
