interface TimeInterval {
  startsAt: string
  endsAt: string
}

const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const clockMinutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : NaN

export const DEFAULT_SLOT_MINUTES = 30
export const DEFAULT_ROOM_SLOT_POLICY = { opensAt: '08:00', closesAt: '18:00', slotMinutes: DEFAULT_SLOT_MINUTES }
export type RoomSlotPolicy = { opensAt: string; closesAt: string; slotMinutes?: number }

export function roomSlotTimes(hours: RoomSlotPolicy = DEFAULT_ROOM_SLOT_POLICY) {
  const opens = clockMinutes(hours.opensAt)
  const closes = clockMinutes(hours.closesAt)
  const step = hours.slotMinutes ?? DEFAULT_SLOT_MINUTES
  if (!Number.isInteger(step) || step < 1 || !(closes - opens >= step)) return []
  return Array.from({ length: Math.floor((closes - opens) / step) + 1 }, (_, index) => clock(opens + index * step))
}

export function roomSlotBounds(date: string, time: string, slots: readonly string[]) {
  const index = slots.indexOf(time)
  const start = index === slots.length - 1 ? slots[index - 1] : time
  const end = slots[index + 1] ?? slots.at(-1)
  return [Date.parse(`${date}T${start}:00+07:00`), Date.parse(`${date}T${end}:00+07:00`)] as const
}

export function isRoomSlotElapsed(date: string, time: string, slots: readonly string[], now: Date, allowPastSlots = false) {
  const [start] = roomSlotBounds(date, time, slots)
  return !allowPastSlots && start < Math.floor(now.getTime() / 60_000) * 60_000
}

export function isRoomSlotOccupied(date: string, time: string, slots: readonly string[], events: readonly TimeInterval[]) {
  const [start, end] = roomSlotBounds(date, time, slots)
  return events.some(event => Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)
}

export function availableEndTimes(times: readonly string[], start: string, unavailable: (time: string) => boolean) {
  const startIndex = times.indexOf(start)
  if (startIndex < 0) return []

  const ends: string[] = []
  for (let index = startIndex; index < times.length - 1 && !unavailable(times[index]); index++) {
    ends.push(times[index + 1])
  }
  return ends
}

export function timeSelectOptions(times: readonly string[], unavailable?: (time: string) => boolean) {
  return times.map((time) => ({ value: time, label: time, disabled: unavailable?.(time) }))
}
