import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { keyLoanKeys } from '../keys/key.queries'
import type { LecturerNameLanguage } from '../keys/lecturer-display.queries'

export interface LecturerNames { name_th: string | null; name_en: string | null }
type LecturerNameRow = LecturerNames & { email: string }

export const adminLecturerNamesQuery = () => queryOptions({
  queryKey: ['admin-lecturer-names'],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('get_admin_lecturer_display_names' as never)
    if (error) throw new Error('ไม่สามารถโหลดชื่ออาจารย์ได้')
    return new Map((data as LecturerNameRow[] | null ?? []).map(row => [row.email, row]))
  },
})

export async function setLecturerNameLanguage(language: LecturerNameLanguage) {
  const { data, error } = await supabase.rpc('set_lecturer_name_language' as never, { p_language: language } as never)
  if (error || data !== language) throw new Error('ไม่สามารถยืนยันการบันทึกภาษาชื่ออาจารย์ได้')
  return language
}

export async function saveLecturerNames(input: LecturerNames & { id: string; pending: boolean }) {
  const { error } = await supabase.rpc('set_admin_lecturer_display_names' as never, {
    p_user_id: input.id,
    p_pending_registration: input.pending,
    p_name_th: input.name_th,
    p_name_en: input.name_en,
  } as never)
  if (error) throw new Error('ไม่สามารถบันทึกชื่ออาจารย์ได้')
}

export function refreshLecturerOptions(client: QueryClient) {
  return client.invalidateQueries({ queryKey: [...keyLoanKeys.all, 'request-options'] })
}
