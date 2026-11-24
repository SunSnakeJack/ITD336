import { roomSlotTimes } from '../../schedules/request-time-options'

export function meetingTimeOptions(date: string, now: Date = new Date(), opensAt = '08:00', closesAt = '18:00', slotMinutes?: number) {
  return roomSlotTimes({ opensAt: opensAt.slice(0, 5), closesAt: closesAt.slice(0, 5), slotMinutes })
    .filter(time => new Date(`${date}T${time}:00+07:00`) > now)
}

export function canOverrideMeetingEvent(canOverride: boolean, event: {
  eventType: string
  status?: string | null
  startsAt: string
}, now: Date) {
  return canOverride && event.eventType === 'BOOKING'
    && event.status === 'APPROVED' && new Date(event.startsAt) > now
}
