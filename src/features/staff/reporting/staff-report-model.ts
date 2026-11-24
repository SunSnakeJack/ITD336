import type { StaffUsageRow } from './staff-usage.types'

export const borrowerLabels: Record<string, string> = {
  ADMIN: 'ผู้ดูแลระบบ', DEAN: 'คณบดี', DEPARTMENT_HEAD: 'หัวหน้าสาขา',
  STAFF: 'เจ้าหน้าที่', TEACHER: 'อาจารย์', STUDENT: 'นักศึกษา', UNKNOWN: 'ไม่ระบุ',
}

export interface ReportDetails {
  transaction_id: string
  user_key: string
  user_type: string
  checked_out_at: string | null
}

export const reportPresets = { month: 'เดือนนี้', previous: 'เดือนที่แล้ว', week: '7 วัน', rolling: '30 วัน' }
export type ReportPreset = keyof typeof reportPresets
const dayMs = 86_400_000
const reportDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
export const shortReportDate = new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const dayKey = (date: Date) => date.toISOString().slice(0, 10)
const dateTime = (day: string) => Date.parse(`${day}T00:00:00Z`)

export function reportRange(preset: ReportPreset, now: Date) {
  const today = reportDay.format(now)
  const end = dateTime(today)
  const current = new Date(end)
  const monthStart = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)
  if (preset === 'month') return { from: dayKey(new Date(monthStart)), to: today }
  if (preset === 'previous') return {
    from: dayKey(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1))),
    to: dayKey(new Date(monthStart - dayMs)),
  }
  return { from: dayKey(new Date(end - (preset === 'week' ? 6 : 29) * dayMs)), to: today }
}

function addCount(values: Map<string, { name: string; count: number }>, key: string, name: string) {
  const previous = values.get(key)
  if (previous) previous.count++
  else values.set(key, { name, count: 1 })
}

const ranking = (values: Map<string, { name: string; count: number }>) =>
  [...values].map(([id, row]) => ({ id, ...row })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'))

export function summarizeReport(rows: StaffUsageRow[], details: ReadonlyMap<string, ReportDetails>, from: string, to: string) {
  const rooms = new Map<string, { name: string; count: number }>()
  const borrowers = new Map<string, { name: string; count: number }>()
  const people = new Map<string, { name: string; count: number }>()
  const counts = new Map<string, number>()
  let duration = 0
  let durationCount = 0
  for (const row of rows) {
    const detail = details.get(row.transactionId)
    const type = detail?.user_type ?? 'UNKNOWN'
    const day = reportDay.format(new Date(row.startsAt))
    counts.set(day, (counts.get(day) ?? 0) + 1)
    addCount(rooms, row.roomId, row.roomCode)
    addCount(borrowers, type, borrowerLabels[type] ?? borrowerLabels.UNKNOWN)
    addCount(people, detail?.user_key ?? row.userName, row.userName)
    const start = row.source === 'BOOKING' ? row.startsAt : detail?.checked_out_at
    const end = row.source === 'BOOKING' ? row.endsAt : row.returnedAt
    if (start && end) {
      const elapsed = Date.parse(end) - Date.parse(start)
      if (Number.isFinite(elapsed) && elapsed >= 0) {
        duration += elapsed
        durationCount++
      }
    }
  }
  const daily = []
  for (let time = dateTime(from); time <= dateTime(to); time += dayMs) {
    const date = dayKey(new Date(time))
    daily.push({ date, count: counts.get(date) ?? 0 })
  }
  const peak = daily.reduce<(typeof daily)[number] | undefined>(
    (best, day) => day.count > (best?.count ?? 0) ? day : best, undefined,
  )
  const roomRanks = ranking(rooms)
  return {
    total: rows.length, average: daily.length ? rows.length / daily.length : 0,
    hours: durationCount ? duration / 3_600_000 : null, daily, peak,
    most: roomRanks[0], least: roomRanks.at(-1),
    rooms: roomRanks, types: ranking(borrowers), users: ranking(people),
  }
}
