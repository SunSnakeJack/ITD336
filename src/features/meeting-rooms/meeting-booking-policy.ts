import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

type MeetingBookingPolicy = { allowed_dates: string[]; opens_at: string; closes_at: string }
export const meetingBookingPolicyKey = ['meeting-booking-policy'] as const

export const meetingBookingPolicyQuery = () => queryOptions({
  queryKey: meetingBookingPolicyKey,
  refetchInterval: 60_000,
  queryFn: async () => {
    // Regenerate the RPC type after migration 0072 is applied.
    const { data, error } = await supabase.rpc('get_meeting_booking_policy' as never)
    if (error) throw new Error('ไม่สามารถโหลดวันและเวลาที่เปิดจองได้')
    const policy = (data as MeetingBookingPolicy[] | null)?.[0]
    if (!policy) throw new Error('ไม่พบกฎการจองห้องประชุม')
    return policy
  },
})
