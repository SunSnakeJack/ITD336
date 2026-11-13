import { describe, expect, it } from 'vitest'
import { staffNavigation, staffRoutePaths } from './staff-navigation'

describe('staff navigation contract', () => {
  it('registers all required staff screens exactly once', () => {
    expect(staffRoutePaths).toEqual([
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
    ])
  })

  it('keeps primary navigation concise while linking every module', () => {
    expect(staffNavigation.map((item) => item.label)).toEqual([
      'แดชบอร์ด', 'จัดการผู้ใช้งาน', 'จัดการข้อมูลห้อง', 'อนุมัติคำขอ', 'การตั้งค่าสิทธิ์',
    ])
    expect(staffNavigation.every((item) => item.to.startsWith('/staff'))).toBe(true)
  })
})
