const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const bangkokDateKey = (value: string | Date) => dateFormatter.format(new Date(value))
export const bangkokClock = (value: string | Date) => timeFormatter.format(new Date(value))

const minuteOfDay = (value: string) => {
  const [hour, minute] = bangkokClock(value).split(':').map(Number)
  return hour * 60 + minute
}
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export function freeRangesForBangkokDay(events: Array<{ startsAt: string; endsAt: string }>, date: string) {
  const ranges: string[] = []
  let cursor = 480
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
