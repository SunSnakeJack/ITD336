import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

it('includes pending meeting bookings in the latest staff dashboard feed', () => {
  const directory = 'supabase/migrations/'
  const definition = readdirSync(directory).filter(file => file.endsWith('.sql')).sort().reverse()
    .map(file => readFileSync(directory + file, 'utf8'))
    .find(sql => sql.includes('create or replace function public.get_staff_usage_history()'))
  const meetingFilter = definition?.match(/rt\.usage_scope='MEETING' and b\.status in\(([^)]+)\)/)?.[1]
  expect(meetingFilter?.match(/'\w+'/g)?.sort()).toEqual(["'APPROVED'", "'COMPLETED'", "'IN_USE'", "'PENDING'"])
})

const sql=readFileSync('supabase/migrations/0058_staff_usage_dashboard.sql','utf8')
describe('staff usage reporting migration',()=>{it('classifies the three required room categories',()=>{expect(sql).toContain("'MEETING','GENERAL_LAB','SPECIAL_LAB'")});it('requires reporting or room management permission',()=>{expect(sql).toContain("public.has_permission('REPORT_READ')");expect(sql).toContain("public.has_permission('ROOM_MANAGE')")});it('excludes cancelled and rejected records at the source',()=>{expect(sql).toContain("b.status in ('APPROVED','IN_USE','COMPLETED')");expect(sql).toContain("k.status in ('APPROVED','IN_USE','RETURNED')")})})
