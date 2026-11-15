import { expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase/client'
import { getMeetingBookings, getMeetingWeek } from './meeting-week.service'

vi.mock('../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

it.each(['upcoming', 'history'] as const)('scopes %s booking details to the matching viewer', async period => {
  vi.mocked(supabase.rpc).mockResolvedValue({ error: null, data: [{
    starts_at: '2026-11-17T08:30:00+07:00', ends_at: '2026-11-17T09:00:00+07:00',
    category: 'TEACHER', viewer_id: 'owner', requester_name: 'อาจารย์ทดสอบ', purpose: 'ประชุมคณะ',
  }] } as never)
  const [owner] = await getMeetingBookings('room', period, 'owner')
  expect(owner).toMatchObject({ requester_name: 'อาจารย์ทดสอบ', purpose: 'ประชุมคณะ' })
  for (const viewer of [null, 'other']) {
    const [row] = await getMeetingBookings('room', period, viewer)
    expect(row.requester_name).toBeUndefined()
    expect(row.purpose).toBeUndefined()
  }
  expect(supabase.rpc).toHaveBeenCalledWith('get_meeting_room_booking_list', {
    p_room_id: 'room', p_upcoming: period === 'upcoming',
  })
})

it('exposes private weekly fields only when the server response belongs to the current viewer', async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({
    error: null,
    data: {
      viewer_id: 'owner',
      opens_at: '08:30:00',
      closes_at: '18:30:00',
      events: [{
        starts_at: '2026-11-17T08:30:00+07:00',
        ends_at: '2026-11-17T09:00:00+07:00',
        category: 'TEACHER',
        requester_name: 'อาจารย์ทดสอบ',
        purpose: 'ประชุมคณะ',
      }],
    },
  } as never)

  const owner = await getMeetingWeek('room', '2026-11-15', 'owner')
  expect(owner.events[0]).toMatchObject({ requester_name: 'อาจารย์ทดสอบ', purpose: 'ประชุมคณะ' })
  for (const viewer of [null, 'other']) {
    const week = await getMeetingWeek('room', '2026-11-15', viewer)
    expect(week.events[0].requester_name).toBeUndefined()
    expect(week.events[0].purpose).toBeUndefined()
  }
})
