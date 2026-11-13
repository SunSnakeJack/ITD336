import { describe, expect, it } from 'vitest'
import type { StaffUserDirectoryItem } from '../types/staff-user.types'
import { filterUserDirectory, userDirectoryStats } from './staff-user-directory'

const users: StaffUserDirectoryItem[] = [
  { id: '1', fullName: 'อาจารย์ทดสอบ', email: 'teacher@example.test', accountStatus: 'ACTIVE', roleCodes: ['TEACHER'], roleNames: ['Teacher'] },
  { id: '2', fullName: 'นักศึกษาทดสอบ', email: 'student@example.test', accountStatus: 'SUSPENDED', roleCodes: ['STUDENT'], roleNames: ['Student'] },
  { id: '3', fullName: 'ผู้ใช้ปิดแล้ว', email: 'inactive@example.test', accountStatus: 'INACTIVE', roleCodes: [], roleNames: [] },
]

describe('staff user directory helpers', () => {
  it('summarizes active and suspended accounts without counting inactive accounts as suspended', () => {
    expect(userDirectoryStats(users)).toEqual({ total: 3, active: 1, suspended: 1 })
  })

  it('combines search, role, and status filters', () => {
    expect(filterUserDirectory(users, { search: 'นักศึกษา', role: 'STUDENT', status: 'SUSPENDED' })).toEqual([users[1]])
    expect(filterUserDirectory(users, { search: '', role: 'ALL', status: 'ACTIVE' })).toEqual([users[0]])
  })
})
