export const DAY_LABELS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

export function startOfWeek(input = new Date()) {
  const date = new Date(input)
  const distance = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - distance)
  date.setHours(0, 0, 0, 0)
  return date
}

export function addDays(input: Date, days: number) {
  const result = new Date(input)
  result.setDate(result.getDate() + days)
  return result
}

export function dateKey(input: Date) {
  const year = input.getFullYear()
  const month = String(input.getMonth() + 1).padStart(2, '0')
  const day = String(input.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

export function weekRange(weekStart: Date) {
  return { from: dateKey(weekStart), to: dateKey(addDays(weekStart, 6)) }
}
