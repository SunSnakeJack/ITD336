import { describe, expect, it } from 'vitest'
import { availableEndTimes, isHalfHourOccupied, timeSelectOptions } from './request-time-options'

const day = '2026-11-19'
const times = ['11:00', '11:30', '12:00', '12:30', '13:00']
const unavailable = (time: string) => isHalfHourOccupied(day, time, [
  { startsAt: day + 'T12:00:00+07:00', endsAt: day + 'T12:30:00+07:00' },
])

describe('half-hour request options', () => {
  it('disables only overlapping starts and allows a booking to end at the next booking boundary', () => {
    expect(timeSelectOptions(times.slice(0, -1), unavailable).filter(option => option.disabled).map(option => option.value)).toEqual(['12:00'])
    expect(availableEndTimes(times, '11:00', unavailable)).toEqual(['11:30', '12:00'])
    expect(availableEndTimes(times, '12:00', unavailable)).toEqual([])
    expect(availableEndTimes(times, '12:30', unavailable)).toEqual(['13:00'])
  })

  it('detects a booking that begins partway through a slot', () => {
    expect(isHalfHourOccupied(day, '12:00', [
      { startsAt: day + 'T12:15:00+07:00', endsAt: day + 'T12:45:00+07:00' },
    ])).toBe(true)
  })
})
