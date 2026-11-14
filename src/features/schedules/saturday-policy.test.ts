import { describe, expect, it } from 'vitest'
import { bangkokDateKey, isSaturdayClosed } from './saturday-policy'

describe('Saturday booking exception', () => {
  it('keeps Saturdays closed by default and opens only the selected date', () => {
    expect(isSaturdayClosed('2026-11-14', null, '2026-11-14')).toBe(true)
    expect(isSaturdayClosed('2026-11-14', '2026-11-14', '2026-11-14')).toBe(false)
    expect(isSaturdayClosed('2026-11-21', '2026-11-14', '2026-11-14')).toBe(true)
    expect(isSaturdayClosed('2026-11-15', null, '2026-11-14')).toBe(false)
  })
  it('expires at midnight in Bangkok even if a browser has a cached exception', () => {
    const today = bangkokDateKey(new Date('2026-11-14T17:00:00Z'))
    expect(today).toBe('2026-11-15')
    expect(isSaturdayClosed('2026-11-14', '2026-11-14', today)).toBe(true)
  })
})
