import { describe, expect, it } from 'vitest'
import { staffNavigation, staffRoutePaths } from './staff-navigation'

describe('staff navigation contract', () => {
  it('registers all 16 required staff screens exactly once', () => {
    expect(staffRoutePaths).toEqual([
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
    ])
  })

  it('keeps primary navigation concise while linking every module', () => {
    expect(staffNavigation.map((item) => item.label)).toEqual([
      'ภาพรวมระบบ', 'ข้อมูลห้อง', 'จัดการผู้ใช้งาน', 'จัดการการเบิกกุญแจ',
      'จัดการห้องประชุม', 'ประวัติการใช้งาน', 'Dashboard', 'รายงานและ Export', 'ตั้งค่าระบบ',
    ])
    expect(staffNavigation.every((item) => item.to.startsWith('/staff'))).toBe(true)
  })
})
