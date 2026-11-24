import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

export const keyServiceDaysQueryKey = ['rooms', 'public-closed-today'] as const

export const keyServiceDaysQuery = () => queryOptions({
  queryKey: keyServiceDaysQueryKey,
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_public_rooms_closed_today' as never)
    if (error) throw new Error('ไม่สามารถตรวจสอบวันให้บริการได้', { cause: error })
    return new Set<string>(Array.isArray(data) ? data : [])
  },
  refetchInterval: 60_000,
})
