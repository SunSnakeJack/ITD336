interface TimeInterval {
  startsAt: string
  endsAt: string
}

export function isHalfHourOccupied(date: string, time: string, intervals: readonly TimeInterval[]) {
  const start = Date.parse(`${date}T${time}:00+07:00`)
  return intervals.some(({ startsAt, endsAt }) =>
    Date.parse(startsAt) < start + 30 * 60_000 && Date.parse(endsAt) > start,
  )
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
