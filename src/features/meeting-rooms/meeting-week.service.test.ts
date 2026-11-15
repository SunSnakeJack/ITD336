import { expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase/client'
import { getMeetingWeek } from './meeting-week.service'

vi.mock('../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

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
