const minutesPerDay = 24 * 60

export type MeetingWeekCategory = 'LEADERSHIP' | 'TEACHER' | 'OTHER' | 'BLOCK'
export type MeetingWeekEvent = {
  starts_at: string; ends_at: string; category: MeetingWeekCategory
  requester_name?: string
  purpose?: string
}

export const meetingEventCategories = {
  LEADERSHIP: 'คณบดีและหัวหน้าสาขา',
  TEACHER: 'อาจารย์',
  OTHER: 'จองแล้ว',
  BLOCK: 'ปิดให้บริการ',
} satisfies Record<MeetingWeekCategory, string>

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function meetingWeekStart(date: string, offset = 0) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDate(date, offset * 7 - weekday)
}

export function clockMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function minuteLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function layoutMeetingDay(date: string, opens: number, closes: number, events: MeetingWeekEvent[]) {
  const midnight = Date.parse(`${date}T00:00:00+07:00`)
  const duration = closes - opens
  const clipped = events.flatMap(event => {
    const from = (Date.parse(event.starts_at) - midnight) / 60_000
    const to = (Date.parse(event.ends_at) - midnight) / 60_000
    if (from >= closes || to <= opens || from >= minutesPerDay || to <= from) return []
    return [{ event, start: Math.max(opens, from), end: Math.min(closes, to) }]
  }).sort((first, second) => first.start - second.start)

  const laneEnds: number[] = []
  return clipped.map(({ event, start, end }) => {
    const lane = laneEnds.findIndex(lastEnd => lastEnd <= start)
    const row = lane === -1 ? laneEnds.length : lane
    laneEnds[row] = end
    return { event, row, left: (start - opens) / duration * 100, width: (end - start) / duration * 100 }
  })
}
