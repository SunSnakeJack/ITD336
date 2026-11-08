export function isSelectableRange(start: string, end: string, slots: string[], isUnavailable: (time: string) => boolean) {
  return end > start && slots.filter((time) => time >= start && time < end).every((time) => !isUnavailable(time))
}

export function isTimeSelected(time: string, start: string | null, end: string | null) {
  if (!start) return false
  return end ? time >= start && time <= end : time === start
}
