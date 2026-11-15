import { supabase } from '../../lib/supabase/client'
import { meetingEventCategories, type MeetingWeekEvent } from './utils/meeting-week'

type MeetingWeek = { opens_at: string; closes_at: string; events: MeetingWeekEvent[] }

function isMeetingEvent(value: unknown): value is MeetingWeekEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<MeetingWeekEvent>
  return typeof event.starts_at === 'string' && typeof event.ends_at === 'string'
    && Date.parse(event.starts_at) < Date.parse(event.ends_at)
    && typeof event.category === 'string' && Object.hasOwn(meetingEventCategories, event.category)
}

export async function getMeetingWeek(roomId: string, weekStart: string, viewerId: string | null): Promise<MeetingWeek> {
  // The RPC types can be regenerated when migration 0074 is applied.
  const { data, error } = await supabase.rpc('get_public_meeting_room_week' as never, {
    p_room_id: roomId, p_week_start: weekStart,
  } as never)
  if (error) throw new Error(error.message)
  const week = data as (Partial<MeetingWeek> & { viewer_id?: string | null }) | null
  if (!week || typeof week.opens_at !== 'string' || typeof week.closes_at !== 'string' || !Array.isArray(week.events)) {
    throw new Error('Invalid meeting calendar response')
  }
  const canUsePrivateFields = viewerId !== null && viewerId === week.viewer_id
  const events = week.events.filter(isMeetingEvent).map(({ starts_at, ends_at, category, requester_name, purpose }) => ({
    starts_at, ends_at, category,
    requester_name: canUsePrivateFields && typeof requester_name === 'string' ? requester_name : undefined,
    purpose: canUsePrivateFields && typeof purpose === 'string' ? purpose : undefined,
  }))
  return { opens_at: week.opens_at, closes_at: week.closes_at, events }
}

export type MeetingBookingPeriod = 'upcoming' | 'history'

export async function getMeetingBookings(roomId: string, period: MeetingBookingPeriod): Promise<(MeetingWeekEvent & { pending: boolean })[]> {
  const rpc = period === 'upcoming' ? 'get_public_meeting_room_upcoming' : 'get_public_meeting_room_history'
  // Regenerate the RPC types after migration 0077 is applied.
  const { data, error } = await supabase.rpc(rpc as never, { p_room_id: roomId } as never)
  if (error) throw new Error(error.message)
  const rows: unknown = data
  if (!Array.isArray(rows)) throw new Error('Invalid meeting history response')
  return rows.filter(isMeetingEvent).map(row => ({
    starts_at: row.starts_at, ends_at: row.ends_at, category: row.category,
    pending: 'pending' in row && row.pending === true,
  }))
}
