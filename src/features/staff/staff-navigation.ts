import type { StaffIconName } from './components/StaffIcon'

export interface StaffNavigationItem {
  label: string
  to: string
  icon: StaffIconName
  group: 'หลัก' | 'จัดการ' | 'ระบบ'
  match?: string
}

export const staffNavigation: StaffNavigationItem[] = [
  { label: 'แดชบอร์ด', to: '/staff/usage-dashboard', icon: 'dashboard', group: 'หลัก' },
  { label: 'จัดการผู้ใช้งาน', to: '/staff/users', icon: 'users', group: 'จัดการ' },
  { label: 'จัดการข้อมูลห้อง', to: '/staff/rooms', icon: 'rooms', group: 'จัดการ' },
  { label: 'การตั้งค่าสิทธิ์', to: '/staff/settings', icon: 'permissions', group: 'ระบบ' },
  { label: 'การตั้งค่าการแสดงผล', to: '/staff/display-settings', icon: 'monitor', group: 'ระบบ' },
  { label: 'การตั้งค่าเพิ่มเติม', to: '/staff/additional-settings', icon: 'gear', group: 'ระบบ' },
  { label: 'รายงานสถิติ', to: '/staff/reports', icon: 'reports', group: 'ระบบ' },
  { label: 'Logs', to: '/staff/logs', icon: 'logs', group: 'ระบบ' },
]

export function getStaffNavigationItem(pathname: string) {
  return staffNavigation.find(item => {
    const route = item.match ?? item.to
    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

const staffRoutePermissions: Record<string, readonly string[]> = {
  'usage-dashboard': ['REPORT_READ', 'ROOM_MANAGE'], dashboard: ['REPORT_READ', 'ROOM_MANAGE'],
  reports: ['REPORT_READ'], history: ['REPORT_READ'], logs: ['AUDIT_READ'], users: ['USER_MANAGE'],
  rooms: ['ROOM_MANAGE'], 'meeting-rooms': ['ROOM_MANAGE'], 'key-requests': ['KEY_MANAGE', 'BOOKING_APPROVE'],
  settings: ['SETTINGS_MANAGE'], 'display-settings': ['SETTINGS_MANAGE'], 'additional-settings': ['SETTINGS_MANAGE'],
}

export function canOpenStaffRoute(pathname: string, permissions: readonly string[], admin: boolean) {
  const section = pathname.split('/')[2]
  if (!section) return true
  if (section === 'settings' && !admin) return false
  return staffRoutePermissions[section]?.some(code => permissions.includes(code)) === true
}

export const staffRoutePaths = [
  '/staff',
  '/staff/rooms',
  '/staff/rooms/new',
  '/staff/rooms/:roomId/edit',
  '/staff/rooms/:roomId',
  '/staff/settings',
  '/staff/display-settings',
  '/staff/users',
  '/staff/users/new',
  '/staff/users/:userId/edit',
  '/staff/key-requests',
  '/staff/key-requests/:requestId',
  '/staff/meeting-rooms',
  '/staff/meeting-rooms/new',
  '/staff/meeting-rooms/:roomId/edit',
  '/staff/history/labs',
  '/staff/history/meetings',
  '/staff/dashboard/labs',
  '/staff/dashboard/meetings',
  '/staff/reports',
  '/staff/reports/labs',
  '/staff/reports/meetings',
  '/staff/usage-dashboard',
  '/staff/logs',
  '/staff/additional-settings',
] as const

export const staffPageTitles: Record<string, string> = {
  '/staff': 'ภาพรวมระบบ',
  '/staff/rooms': 'จัดการข้อมูลห้อง',
  '/staff/settings': 'การตั้งค่าสิทธิ์',
  '/staff/display-settings': 'การตั้งค่าการแสดงผล',
  '/staff/users': 'จัดการผู้ใช้งาน',
  '/staff/key-requests': 'จัดการการเบิกกุญแจ',
  '/staff/meeting-rooms': 'จัดการห้องประชุม',
  '/staff/history/labs': 'ประวัติการใช้ห้องปฏิบัติการ',
  '/staff/history/meetings': 'ประวัติการใช้ห้องประชุม',
  '/staff/dashboard/labs': 'Dashboard ห้องปฏิบัติการ',
  '/staff/dashboard/meetings': 'Dashboard ห้องประชุม',
  '/staff/reports': 'รายงานสถิติ',
  '/staff/reports/labs': 'รายงานการใช้ห้องปฏิบัติการ',
  '/staff/reports/meetings': 'รายงานการใช้ห้องประชุม',
  '/staff/usage-dashboard': 'แดชบอร์ด',
  '/staff/logs': 'Logs',
  '/staff/additional-settings': 'การตั้งค่าเพิ่มเติม',
}

export function getStaffPageTitle(pathname: string) {
  if (/^\/staff\/rooms\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มข้อมูลห้อง'
  if (/^\/staff\/rooms\/[^/]+$/.test(pathname)) return 'รายละเอียดห้อง'
  if (/^\/staff\/users\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มผู้ใช้งาน'
  if (/^\/staff\/key-requests\/[^/]+$/.test(pathname)) return 'รายละเอียดคำขอเบิกกุญแจ'
  if (/^\/staff\/meeting-rooms\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มห้องประชุม'
  return staffPageTitles[pathname] ?? 'ระบบเจ้าหน้าที่'
}
