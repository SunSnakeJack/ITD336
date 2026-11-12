import{readFileSync}from'node:fs'
import{join}from'node:path'
import{describe,expect,it}from'vitest'
const sql=readFileSync(join(process.cwd(),'supabase/migrations/0059_past_key_request_setting.sql'),'utf8')
describe('past key request setting migration',()=>{it('defaults the exception to disabled',()=>expect(sql).toContain("'ALLOW_PAST_KEY_REQUEST_SLOTS','false'::jsonb"));it('requires settings permission for mutation',()=>expect(sql).toContain("public.has_permission('SETTINGS_MANAGE')"));it('enforces the disabled setting before insert',()=>{expect(sql).toContain('before insert on public.key_requests');expect(sql).toContain('KEY_REQUEST_PAST_SLOT_DISABLED')});it('retains audit evidence',()=>expect(sql).toContain("'KEY_REQUEST_TIMING_SETTING_UPDATED'"))})
