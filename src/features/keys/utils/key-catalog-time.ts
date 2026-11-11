const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const bangkokDateKey = (value: string | Date) => dateFormatter.format(new Date(value))
export const bangkokClock = (value: string | Date) => timeFormatter.format(new Date(value))

const minuteOfDay = (value: string) => {
  const [hour, minute] = bangkokClock(value).split(':').map(Number)
  return hour * 60 + minute
}
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export function freeRangesForBangkokDay(events: Array<{ startsAt: string; endsAt: string }>, date: string, now: Date = new Date()) {
  const ranges: string[] = []
  const [currentHour, currentMinute] = bangkokClock(now).split(':').map(Number)
  const roundedCurrentMinute = Math.ceil((currentHour * 60 + currentMinute) / 30) * 30
  let cursor = date === bangkokDateKey(now) ? Math.max(480, roundedCurrentMinute) : 480
  if (cursor >= 1080) return ranges
  const active = events.filter((event) => bangkokDateKey(event.startsAt) === date).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  for (const event of active) {
    const start = Math.max(480, minuteOfDay(event.startsAt))
    const end = Math.min(1080, minuteOfDay(event.endsAt))
    if (start > cursor) ranges.push(`${clock(cursor)}–${clock(start)} น.`)
    cursor = Math.max(cursor, end)
  }
  if (cursor < 1080) ranges.push(`${clock(cursor)}–18:00 น.`)
  return ranges
}

export function isSlotElapsedForBangkokDate(time: string, date: string, now: Date = new Date()): boolean {
  const today = bangkokDateKey(now)
  if (date < today) return true
  if (date > today) return false

  const [currentHour, currentMinute] = bangkokClock(now).split(':').map(Number)
  const roundedCurrentMinute = Math.ceil((currentHour * 60 + currentMinute) / 30) * 30
  const targetTime = time === '18:00' ? '17:30' : time
  const [slotHour, slotMinute] = targetTime.split(':').map(Number)
  const slotMinutes = slotHour * 60 + slotMinute

  return slotMinutes < roundedCurrentMinute
}
