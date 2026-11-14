const bangkokDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function bangkokDateKey(date = new Date()) {
  return bangkokDateFormat.format(date)
}

export function isSaturday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 6
}

export function isSaturdayClosed(date: string, openDate?: string | null, today = bangkokDateKey()) {
  return isSaturday(date) && (date !== openDate || date < today)
}
