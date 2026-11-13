import type { AdminBooking } from '../../bookings/booking.types'
import type { Room } from '../../rooms/room.types'

export type RoomStatusFilter = 'all' | 'active' | 'inactive'
export type RoomCategoryFilter = 'all' | 'general' | 'special' | 'meeting'
export type RoomSort = 'code' | 'type' | 'capacity' | 'status'

export function isMeetingRoom(room: Room) {
  const value = `${room.code} ${room.name}`.toLowerCase()
  return value.includes('meet') || value.includes('ประชุม')
}

export function filterRooms(rooms: Room[], search: string, status: RoomStatusFilter) {
  const term = search.trim().toLocaleLowerCase('th')
  return rooms.filter((room) => {
    const matchesText = !term || `${room.code} ${room.name} ${room.building ?? ''} ${room.floor ?? ''}`.toLocaleLowerCase('th').includes(term)
    const matchesStatus = status === 'all' || (status === 'active' ? room.active : !room.active)
    return matchesText && matchesStatus
  })
}

export function roomCategory(room: Room, typeLabel = ''): Exclude<RoomCategoryFilter, 'all'> {
  const value = `${room.code} ${room.name} ${typeLabel}`.toLocaleLowerCase('th')
  if (value.includes('meet') || value.includes('ประชุม')) return 'meeting'
  if (value.includes('special') || value.includes('studio') || value.includes('พิเศษ')) return 'special'
  return 'general'
}

export function filterAndSortRooms(rooms: Room[], options: { search: string; status: RoomStatusFilter; category: RoomCategoryFilter; sort: RoomSort; typeLabel: (room: Room) => string }) {
  const filtered = filterRooms(rooms, options.search, options.status).filter((room) => options.category === 'all' || roomCategory(room, options.typeLabel(room)) === options.category)
  return [...filtered].sort((a, b) => {
    if (options.sort === 'type') return options.typeLabel(a).localeCompare(options.typeLabel(b), 'th') || a.code.localeCompare(b.code)
    if (options.sort === 'capacity') return a.capacity - b.capacity || a.code.localeCompare(b.code)
    if (options.sort === 'status') return Number(b.active) - Number(a.active) || a.code.localeCompare(b.code)
    return a.code.localeCompare(b.code, undefined, { numeric: true })
  })
}

export interface MonthlyCount { key: string; label: string; count: number }

export function aggregateBookingsByMonth(bookings: AdminBooking[]): MonthlyCount[] {
  const counts = new Map<string, { date: Date; count: number }>()
  for (const booking of bookings) {
    const date = new Date(booking.startsAt)
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    if (!year || !month) continue
    const key = `${year}-${month}`
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { date, count: 1 })
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    key,
    label: new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(value.date).replace('.', '.'),
    count: value.count,
  }))
}

export function mostFrequentUsers(bookings: AdminBooking[], limit = 5) {
  const counts = new Map<string, number>()
  bookings.forEach((booking) => counts.set(booking.userName, (counts.get(booking.userName) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th')).slice(0, limit)
}

export function isFuture(iso: string, now = Date.now()) { return new Date(iso).getTime() > now }

export const bangkokDateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
export const bangkokDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })
