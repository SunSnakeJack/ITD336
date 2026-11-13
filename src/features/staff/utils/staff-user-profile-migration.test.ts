import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/0065_admin_user_profile_management.sql'), 'utf8')

describe('admin user profile migration', () => {
  it('uses admin-authorized security definer RPCs and audit logging', () => {
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain("public.has_role('ADMIN')")
    expect(sql).toContain('first_name')
    expect(sql).toContain('last_name')
    expect(sql).toContain('ADMIN_USER_PROFILE_UPDATED')
    expect(sql).toContain('grant execute')
  })
})
