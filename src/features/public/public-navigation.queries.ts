import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

export const navigationModes = {
  top: 'แถบเมนูด้านบน',
  bottom: 'แถบเมนูด้านล่าง',
  both: 'แถบเมนูด้านบนและด้านล่าง',
} as const
export type NavigationMode = keyof typeof navigationModes

export const publicNavigationQuery = () => queryOptions({
  queryKey: ['public-navigation', 'mode'],
  staleTime: 60_000,
  retry: false,
  queryFn: async (): Promise<NavigationMode> => {
    const { data, error } = await supabase.rpc('get_public_navigation_mode' as never)
    if (error || (data !== 'top' && data !== 'bottom' && data !== 'both')) {
      throw new Error('โหลดรูปแบบเมนูนำทางไม่สำเร็จ')
    }
    return data
  },
})

export async function saveNavigationMode(mode: NavigationMode) {
  const { data, error } = await supabase.rpc('set_public_navigation_mode' as never, { p_mode: mode } as never)
  if (error || data !== mode) throw new Error('บันทึกรูปแบบเมนูนำทางไม่สำเร็จ')
  return mode
}
