import { describe, expect, it } from 'vitest'
import type { StaffUserDirectoryItem } from '../types/staff-user.types'
import { filterUserDirectory, getStaffInitials, userDirectoryStats } from './staff-user-directory'

const users: StaffUserDirectoryItem[] = [
  { id: '1', fullName: 'อาจารย์ทดสอบ', email: 'teacher@example.test', accountStatus: 'ACTIVE', roleCodes: ['TEACHER'], roleNames: ['Teacher'] },
  { id: '2', fullName: 'นักศึกษาทดสอบ', email: 'student@example.test', accountStatus: 'SUSPENDED', roleCodes: ['STUDENT'], roleNames: ['Student'] },
  { id: '3', fullName: 'ผู้ใช้ปิดแล้ว', email: 'inactive@example.test', accountStatus: 'INACTIVE', roleCodes: [], roleNames: [] },
]

describe('staff user directory helpers', () => {
  it('uses the first letter of each of the first two name parts', () => {
    expect(getStaffInitials('  Sufeeyan   Taleh ')).toBe('ST')
    expect(getStaffInitials('ทดสอบ')).toBe('ท')
    expect(getStaffInitials('')).toBe('U')
  })

  it('finds a reserved teacher by email and pending status', () => {
    const pending: StaffUserDirectoryItem = { ...users[0], pendingRegistration: true, accountStatus: null }
    expect(filterUserDirectory([pending], { search: 'TEACHER@', role: 'TEACHER', status: 'PENDING_REGISTRATION' })).toEqual([pending])
    expect(filterUserDirectory([pending], { search: '', role: 'ALL', status: 'ACTIVE' })).toEqual([])
    expect(userDirectoryStats([pending])).toEqual({ total: 1, active: 0, suspended: 0, pending: 1 })
  })

  it('summarizes active and suspended accounts without counting inactive accounts as suspended', () => {
    expect(userDirectoryStats(users)).toEqual({ total: 3, active: 1, suspended: 1, pending: 0 })
  })

  it('combines search, role, and status filters', () => {
    expect(filterUserDirectory(users, { search: 'นักศึกษา', role: 'STUDENT', status: 'SUSPENDED' })).toEqual([users[1]])
    expect(filterUserDirectory(users, { search: '', role: 'ALL', status: 'ACTIVE' })).toEqual([users[0]])
    expect(filterUserDirectory(users, { search: '', role: 'ALL', status: 'INACTIVE' })).toEqual([users[2]])
  })
})
