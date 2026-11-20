import { queryOptions } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'

export type LecturerNameLanguage = 'th' | 'en'

async function getLecturerLanguage(): Promise<LecturerNameLanguage> {
  const { data, error } = await supabase.rpc('get_lecturer_name_language' as never)
  if (error || (data !== 'th' && data !== 'en')) throw new Error('ไม่สามารถโหลดภาษาชื่ออาจารย์ได้')
  return data
}

export const lecturerLanguageQuery = () => queryOptions({
  queryKey: ['lecturer-name-language'],
  queryFn: getLecturerLanguage,
})
