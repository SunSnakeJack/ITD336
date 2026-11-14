import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

export const saturdayPolicyKey = ['schedule-policy', 'open-saturday'] as const

export const saturdayPolicyQuery = () => queryOptions({
  queryKey: saturdayPolicyKey,
  queryFn: async () => {
    // RPC types are generated after the migration is applied to the target database.
    const { data, error } = await supabase.rpc('get_open_saturday' as never)
    if (error) throw new Error(error.message)
    return typeof data === 'string' ? data : null
  },
  refetchInterval: 60_000,
})
