export function formatThaiDate(date: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${date}T12:00:00+07:00`))
}
