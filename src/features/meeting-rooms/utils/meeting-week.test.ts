import { expect, it } from 'vitest'
import { layoutMeetingDay, meetingWeekStart, type MeetingWeekEvent } from './meeting-week'

it('uses Sunday week boundaries across months and years', () => {
  expect(meetingWeekStart('2027-01-01')).toBe('2026-12-27')
  expect(meetingWeekStart('2027-01-01', -1)).toBe('2026-12-20')
  expect(meetingWeekStart('2027-01-01', 1)).toBe('2027-01-03')
})

it('positions half-hour events in Bangkok time and stacks overlaps', () => {
  const events: MeetingWeekEvent[] = [
    { starts_at: '2026-11-15T01:30:00Z', ends_at: '2026-11-15T04:30:00Z', category: 'LEADERSHIP' },
    { starts_at: '2026-11-15T09:00:00+07:00', ends_at: '2026-11-15T10:00:00+07:00', category: 'TEACHER' },
    { starts_at: '2026-11-15T17:30:00+07:00', ends_at: '2026-11-15T19:00:00+07:00', category: 'BLOCK' },
  ]
  expect(layoutMeetingDay('2026-11-15', 480, 1080, events)).toEqual([
    { event: events[0], row: 0, left: 5, width: 30 },
    { event: events[1], row: 1, left: 10, width: 10 },
    { event: events[2], row: 0, left: 95, width: 5 },
  ])
  expect(layoutMeetingDay('2026-11-16', 480, 1080, events)).toEqual([])
})
