import { DEFAULT_ROOM_SLOT_POLICY, isRoomSlotElapsed, isRoomSlotOccupied, roomSlotTimes, type RoomSlotPolicy } from '../../schedules/request-time-options'

const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

export const bangkokDateKey = (value: string | Date) => dateFormatter.format(new Date(value))
export const bangkokClock = (value: string | Date) => timeFormatter.format(new Date(value))

export function freeRangesForBangkokDay(events: Array<{ startsAt: string; endsAt: string }>, date: string, now: Date = new Date(), allowPastSlots = false, hours: RoomSlotPolicy = DEFAULT_ROOM_SLOT_POLICY) {
  const slots = roomSlotTimes(hours)
  const ranges: string[] = []
  const excludeElapsed = date === bangkokDateKey(now) && !allowPastSlots
  let rangeStart: string | undefined
  for (const [index, time] of slots.entries()) {
    const isFree = index < slots.length - 1 && !isRoomSlotOccupied(date, time, slots, events)
      && !(excludeElapsed && isRoomSlotElapsed(date, time, slots, now))
    if (isFree) rangeStart ??= time
    else if (rangeStart) {
      ranges.push(`${rangeStart}–${time} น.`)
      rangeStart = undefined
    }
  }
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
