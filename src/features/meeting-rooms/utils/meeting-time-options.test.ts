import { describe, expect, it } from 'vitest'
import { meetingTimeOptions } from './meeting-time-options'

describe('meetingTimeOptions', () => {
  it('offers future Bangkok times today and preserves the closing time as an end option', () => {
    expect(meetingTimeOptions('2026-11-15', new Date('2026-11-15T17:00:15+07:00')))
      .toEqual(['17:30', '18:00'])
    expect(meetingTimeOptions('2026-11-15', new Date('2026-11-15T17:30:00+07:00')))
      .toEqual(['18:00'])
  })

  it('uses Bangkok dates when UTC is still on the previous day', () => {
    const now = new Date('2026-11-14T17:15:00Z')
    expect(meetingTimeOptions('2026-11-14', now)).toEqual([])
    expect(meetingTimeOptions('2026-11-15', now)[0]).toBe('08:00')
  })
})
