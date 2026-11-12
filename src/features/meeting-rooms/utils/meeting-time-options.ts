import { isSlotElapsedForBangkokDate } from '../../keys/utils/key-catalog-time'

export const MEETING_TIMES = Array.from(
  { length: 21 },
  (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
)

export function meetingTimeOptions(date: string, now: Date = new Date()) {
  return MEETING_TIMES.filter((time) => !isSlotElapsedForBangkokDate(time, date, now))
}
