import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

export const showElapsedRoomSlotsQuery = () => queryOptions({
  queryKey: ['schedule-display', 'show-elapsed'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_show_elapsed_room_slots' as never)
    if (error || typeof data !== 'boolean') throw new Error('ไม่สามารถโหลดการแสดงผลตารางได้')
    return data as boolean
  },
  retry: false,
})

export async function setShowElapsedRoomSlots(show: boolean) {
  const { data, error } = await supabase.rpc('set_show_elapsed_room_slots' as never, { p_show: show } as never)
  if (error || data !== show) throw new Error('บันทึกการแสดงผลตารางไม่สำเร็จ')
  return show
}
