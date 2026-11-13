export interface StaffNavigationItem {
  label: string
  to: string
  icon: string
  group: 'หลัก' | 'จัดการ' | 'ระบบ'
  match?: string
}

export const staffNavigation: StaffNavigationItem[] = [
  { label: 'แดชบอร์ด', to: '/staff/usage-dashboard', icon: '▥', group: 'หลัก' },
  { label: 'จัดการผู้ใช้งาน', to: '/staff/users', icon: '👤', group: 'จัดการ' },
  { label: 'จัดการข้อมูลห้อง', to: '/staff/rooms', icon: '▦', group: 'จัดการ' },
  { label: 'อนุมัติคำขอ', to: '/staff/key-requests', icon: '✓', group: 'จัดการ' },
  { label: 'การตั้งค่าสิทธิ์', to: '/staff/settings', icon: '⚙', group: 'ระบบ' },
]

export const staffRoutePaths = [
  '/staff',
  '/staff/rooms',
  '/staff/rooms/new',
  '/staff/rooms/:roomId/edit',
  '/staff/rooms/:roomId',
  '/staff/settings',
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
  '/staff/reports/labs',
  '/staff/reports/meetings',
  '/staff/usage-dashboard',
] as const

export const staffPageTitles: Record<string, string> = {
  '/staff': 'ภาพรวมระบบ',
  '/staff/rooms': 'จัดการข้อมูลห้อง',
  '/staff/settings': 'การตั้งค่าสิทธิ์',
  '/staff/users': 'จัดการผู้ใช้งาน',
  '/staff/key-requests': 'จัดการการเบิกกุญแจ',
  '/staff/meeting-rooms': 'จัดการห้องประชุม',
  '/staff/history/labs': 'ประวัติการใช้ห้องปฏิบัติการ',
  '/staff/history/meetings': 'ประวัติการใช้ห้องประชุม',
  '/staff/dashboard/labs': 'Dashboard ห้องปฏิบัติการ',
  '/staff/dashboard/meetings': 'Dashboard ห้องประชุม',
  '/staff/reports/labs': 'รายงานการใช้ห้องปฏิบัติการ',
  '/staff/reports/meetings': 'รายงานการใช้ห้องประชุม',
  '/staff/usage-dashboard': 'แดชบอร์ด',
}

export function getStaffPageTitle(pathname: string) {
  if (/^\/staff\/rooms\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มข้อมูลห้อง'
  if (/^\/staff\/rooms\/[^/]+$/.test(pathname)) return 'รายละเอียดห้อง'
  if (/^\/staff\/users\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มผู้ใช้งาน'
  if (/^\/staff\/key-requests\/[^/]+$/.test(pathname)) return 'รายละเอียดคำขอเบิกกุญแจ'
  if (/^\/staff\/meeting-rooms\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มห้องประชุม'
  return staffPageTitles[pathname] ?? 'ระบบเจ้าหน้าที่'
}
