import { describe, expect, it } from 'vitest'
import type { AdminBooking } from '../../bookings/booking.types'
import type { Room } from '../../rooms/room.types'
import { aggregateBookingsByMonth, filterRooms, isMeetingRoom } from './staff-analytics'

const room = (values: Partial<Room>): Room => ({ id: '1', code: '2401', name: 'ห้องปฏิบัติการ', room_type_id: 'lab', building: 'อาคาร 2', floor: '4', location_description: null, capacity: 30, description: null, booking_enabled: true, active: true, created_at: '', updated_at: '', ...values })
const booking = (values: Partial<AdminBooking>): AdminBooking => ({ id: '1', bookingCode: 'B1', roomCode: '2401', roomName: 'Lab', userName: 'User', startsAt: '2026-11-01T09:00:00+07:00', endsAt: '2026-11-01T10:00:00+07:00', purpose: 'Test', requiresKey: false, status: 'COMPLETED', createdAt: '', ...values })

describe('staff analytics', () => {
  it('finds rooms by code or Thai name and active state', () => {
    const rooms = [room({ id: '1' }), room({ id: '2', code: 'MEET-1', name: 'ห้องประชุมคณะ', active: false })]
    expect(filterRooms(rooms, 'ประชุม', 'all').map((item) => item.id)).toEqual(['2'])
    expect(filterRooms(rooms, '', 'active').map((item) => item.id)).toEqual(['1'])
  })

  it('recognizes meeting rooms without inventing a database type', () => {
    expect(isMeetingRoom(room({ code: 'MEET-FACULTY', name: 'ห้องประชุมคณะ' }))).toBe(true)
    expect(isMeetingRoom(room({ code: '2401', name: 'Lab 2401' }))).toBe(false)
  })

  it('groups actual bookings by Bangkok calendar month', () => {
    const result = aggregateBookingsByMonth([
      booking({ id: '1', startsAt: '2026-10-31T18:30:00Z' }),
      booking({ id: '2', startsAt: '2026-11-15T09:00:00+07:00' }),
      booking({ id: '3', startsAt: '2026-12-01T09:00:00+07:00' }),
    ])
    expect(result).toEqual([{ key: '2026-11', label: 'พ.ย. 69', count: 2 }, { key: '2026-12', label: 'ธ.ค. 69', count: 1 }])
  })
})
