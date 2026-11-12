import{readFileSync}from'node:fs'
import{join}from'node:path'
import{describe,expect,it}from'vitest'
const sql=readFileSync(join(process.cwd(),'supabase/migrations/0058_staff_usage_dashboard.sql'),'utf8')
describe('staff usage reporting migration',()=>{it('classifies the three required room categories',()=>{expect(sql).toContain("'MEETING','GENERAL_LAB','SPECIAL_LAB'")});it('requires reporting or room management permission',()=>{expect(sql).toContain("public.has_permission('REPORT_READ')");expect(sql).toContain("public.has_permission('ROOM_MANAGE')")});it('excludes cancelled and rejected records at the source',()=>{expect(sql).toContain("b.status in ('APPROVED','IN_USE','COMPLETED')");expect(sql).toContain("k.status in ('APPROVED','IN_USE','RETURNED')")})})
