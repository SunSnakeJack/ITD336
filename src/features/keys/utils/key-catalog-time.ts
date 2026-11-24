const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const bangkokDateKey = (value: string | Date) => dateFormatter.format(new Date(value))
export const bangkokClock = (value: string | Date) => timeFormatter.format(new Date(value))

const minuteOfDay = (value: string) => {
  const [hour, minute] = bangkokClock(value).split(':').map(Number)
  return hour * 60 + minute
}
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const clockMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))

export const DEFAULT_KEY_HOURS = { opensAt: '08:00', closesAt: '18:00' }

export function keySlotTimes(hours = DEFAULT_KEY_HOURS) {
  const opens = clockMinutes(hours.opensAt)
  const closes = clockMinutes(hours.closesAt)
  const slots = [hours.opensAt]
  for (let minute = Math.floor(opens / 30) * 30 + 30; minute < closes; minute += 30) slots.push(clock(minute))
  return [...slots, hours.closesAt]
}

export function keySlotBounds(date: string, time: string, slots: string[]) {
  const index = slots.indexOf(time)
  const start = index === slots.length - 1 ? slots[index - 1] : time
  const end = slots[index + 1] ?? slots.at(-1)
  return [Date.parse(`${date}T${start}:00+07:00`), Date.parse(`${date}T${end}:00+07:00`)] as const
}

export function isKeySlotElapsed(date: string, time: string, slots: string[], now: Date, allowPastSlots = false) {
  const [start] = keySlotBounds(date, time, slots)
  return !allowPastSlots && start < Math.floor(now.getTime() / 60_000) * 60_000
}

export function keySlotOccupied(date: string, time: string, slots: string[], events: readonly { startsAt: string; endsAt: string }[]) {
  const [start, end] = keySlotBounds(date, time, slots)
  return events.some(event => Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)
}

export function freeRangesForBangkokDay(events: Array<{ startsAt: string; endsAt: string }>, date: string, now: Date = new Date(), allowPastSlots = false, hours = DEFAULT_KEY_HOURS) {
  const opens = clockMinutes(hours.opensAt)
  const closes = clockMinutes(hours.closesAt)
  const ranges: string[] = []
  const slots = keySlotTimes(hours)
  const first = date === bangkokDateKey(now) && !allowPastSlots
    ? slots.slice(0, -1).find(time => !isKeySlotElapsed(date, time, slots, now)) : hours.opensAt
  if (!first) return ranges
  let cursor = clockMinutes(first)
  const active = events.filter((event) => bangkokDateKey(event.startsAt) === date).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  for (const event of active) {
    const start = Math.min(closes, Math.max(opens, minuteOfDay(event.startsAt)))
    const end = Math.min(closes, minuteOfDay(event.endsAt))
    if (start > cursor) ranges.push(`${clock(cursor)}–${clock(start)} น.`)
    cursor = Math.max(cursor, end)
  }
  if (cursor < closes) ranges.push(`${clock(cursor)}–${hours.closesAt} น.`)
  return ranges
}

export function isSlotElapsedForBangkokDate(time: string, date: string, now: Date = new Date(), allowPastSlots = false): boolean {
  if (allowPastSlots) return false
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
