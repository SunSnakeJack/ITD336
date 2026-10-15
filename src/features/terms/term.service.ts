import { supabase, unwrap } from '../../lib/supabase/client'
import type { AcademicTerm, AcademicTermInput } from './term.types'

type TermRow = { id: string; academic_year: string; term_code: string; starts_on: string; ends_on: string; active: boolean }

export async function getAcademicTerms(): Promise<AcademicTerm[]> {
  const rows = await unwrap<TermRow[]>(supabase.from('academic_terms' as never).select('*').order('starts_on', { ascending: false }))
  return rows.map((row) => ({ id: row.id, academicYear: row.academic_year, termCode: row.term_code, startsOn: row.starts_on, endsOn: row.ends_on, active: row.active }))
}

export async function saveAcademicTerm(input: AcademicTermInput) {
  const result = await supabase.rpc('upsert_academic_term' as never, { p_term_id: input.id ?? null, p_academic_year: input.academicYear, p_term_code: input.termCode, p_starts_on: input.startsOn, p_ends_on: input.endsOn, p_active: input.active } as never) as unknown as { data: string | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data
}
