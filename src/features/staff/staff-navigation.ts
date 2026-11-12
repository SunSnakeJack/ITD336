export interface StaffNavigationItem {
  label: string
  to: string
  icon: string
  match?: string
}

export const staffNavigation: StaffNavigationItem[] = [
  { label: 'ภาพรวมระบบ', to: '/staff', icon: '⌂' },
  { label: 'ข้อมูลห้อง', to: '/staff/rooms', icon: '▦' },
  { label: 'จัดการผู้ใช้งาน', to: '/staff/users', icon: '♙' },
  { label: 'จัดการการเบิกกุญแจ', to: '/staff/key-requests', icon: '⌘' },
  { label: 'จัดการห้องประชุม', to: '/staff/meeting-rooms', icon: '▤' },
  { label: 'ประวัติการใช้งาน', to: '/staff/history/labs', match: '/staff/history', icon: '◷' },
  { label: 'Dashboard', to: '/staff/dashboard/labs', match: '/staff/dashboard', icon: '◫' },
  { label: 'รายงานและ Export', to: '/staff/reports/labs', match: '/staff/reports', icon: '⇩' },
  { label: 'ตั้งค่าระบบ', to: '/staff/settings', icon: '⚙' },
]

export const staffRoutePaths = [
  '/staff',
  '/staff/rooms',
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
] as const

export const staffPageTitles: Record<string, string> = {
  '/staff': 'ภาพรวมระบบ',
  '/staff/rooms': 'ข้อมูลห้อง',
  '/staff/settings': 'ตั้งค่าระบบ',
  '/staff/users': 'จัดการผู้ใช้งาน',
  '/staff/key-requests': 'จัดการการเบิกกุญแจ',
  '/staff/meeting-rooms': 'จัดการห้องประชุม',
  '/staff/history/labs': 'ประวัติการใช้ห้องปฏิบัติการ',
  '/staff/history/meetings': 'ประวัติการใช้ห้องประชุม',
  '/staff/dashboard/labs': 'Dashboard ห้องปฏิบัติการ',
  '/staff/dashboard/meetings': 'Dashboard ห้องประชุม',
  '/staff/reports/labs': 'รายงานการใช้ห้องปฏิบัติการ',
  '/staff/reports/meetings': 'รายงานการใช้ห้องประชุม',
}

export function getStaffPageTitle(pathname: string) {
  if (/^\/staff\/rooms\/[^/]+$/.test(pathname)) return 'รายละเอียดห้อง'
  if (/^\/staff\/users\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มผู้ใช้งาน'
  if (/^\/staff\/key-requests\/[^/]+$/.test(pathname)) return 'รายละเอียดคำขอเบิกกุญแจ'
  if (/^\/staff\/meeting-rooms\/(new|[^/]+\/edit)$/.test(pathname)) return 'แบบฟอร์มห้องประชุม'
  return staffPageTitles[pathname] ?? 'ระบบเจ้าหน้าที่'
}
