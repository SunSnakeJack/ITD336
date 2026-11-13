import { describe, expect, it } from 'vitest'
import { getRoleTone, getUserTone } from './staff-user-visuals'

describe('staff user visuals', () => {
  it('keeps avatar colors deterministic', () => {
    expect(getUserTone('user@example.test')).toBe(getUserTone('user@example.test'))
  })

  it('maps each known role to its semantic tone', () => {
    expect(getRoleTone('ADMIN')).toBe('blue')
    expect(getRoleTone('STAFF')).toBe('teal')
    expect(getRoleTone('STUDENT')).toBe('amber')
    expect(getRoleTone('TEACHER')).toBe('purple')
    expect(getRoleTone('PRIORITY_USER')).toBe('red')
  })
})
