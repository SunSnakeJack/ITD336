import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql=readFileSync(resolve(process.cwd(),'supabase/migrations/0061_admin_room_soft_delete.sql'),'utf8').toLowerCase()

describe('admin room soft delete migration',()=>{
 it('checks permission, updates active, and records an audit event',()=>{
  expect(sql).toContain("public.has_permission('room_manage')")
  expect(sql).toContain('update public.rooms set active=p_active')
  expect(sql).toContain('public.write_audit')
  expect(sql).toContain("'room_deactivated'")
  expect(sql).toContain("grant execute on function public.set_admin_room_active")
 })
})
