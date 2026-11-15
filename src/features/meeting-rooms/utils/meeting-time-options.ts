import { isSlotElapsedForBangkokDate } from '../../keys/utils/key-catalog-time'

export const MEETING_TIMES = Array.from(
  { length: 21 },
  (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
)

export function meetingTimeOptions(date: string, now: Date = new Date(), opensAt = '08:00', closesAt = '18:00') {
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
  const start = Math.ceil(minutes(opensAt) / 30) * 30
  const end = Math.floor(minutes(closesAt) / 30) * 30
  return Array.from({ length: Math.max(0, (end - start) / 30 + 1) }, (_, index) => {
    const value = start + index * 30
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  }).filter(time => !isSlotElapsedForBangkokDate(time, date, now))
}
