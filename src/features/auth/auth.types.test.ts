import { describe, expect, it } from 'vitest'
import { getRequesterStatus, type AuthIdentity } from './auth.types'

const account: AuthIdentity = {
  userId: 'user-1', fullName: 'Test User', email: 'user@example.test', role: null,
}

describe('booking requester status', () => {
  it.each([
    ['PRIORITY_USER', 'TEACHER'],
    ['DEAN', 'TEACHER'],
    ['DEPARTMENT_HEAD', 'TEACHER'],
    ['TEACHER', 'TEACHER'],
    ['STUDENT', 'STUDENT'],
  ] as const)('maps %s to %s', (role, status) => {
    expect(getRequesterStatus({ ...account, role })).toBe(status)
  })

  it('uses secondary teaching and student roles when the primary role is administrator', () => {
    expect(getRequesterStatus({ ...account, role: 'ADMIN', roles: ['ADMIN', 'TEACHER', 'STUDENT'] })).toBe('TEACHER')
    expect(getRequesterStatus({ ...account, role: 'ADMIN', roles: ['ADMIN', 'STUDENT'] })).toBe('STUDENT')
  })

  it('leaves unclassified accounts and guests without a preset', () => {
    expect(getRequesterStatus(null)).toBeUndefined()
    expect(getRequesterStatus({ ...account, role: 'STAFF' })).toBeUndefined()
  })
})
