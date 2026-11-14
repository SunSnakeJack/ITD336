import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql=readFileSync(join(process.cwd(),'supabase/migrations/0053_admin_user_directory.sql'),'utf8')
const roleSql=readFileSync(join(process.cwd(),'supabase/migrations/0054_admin_user_role_management.sql'),'utf8')
const notificationSql=readFileSync(join(process.cwd(),'supabase/migrations/0055_key_request_in_app_notifications.sql'),'utf8')
const realtimeSql=readFileSync(join(process.cwd(),'supabase/migrations/0056_profile_identity_realtime.sql'),'utf8')
const adminUserFunction=readFileSync(join(process.cwd(),'supabase/functions/admin-user-management/index.ts'),'utf8')
const foundationSql=readFileSync(join(process.cwd(),'supabase/migrations/0001_schema.sql'),'utf8')

describe('admin user directory migration',()=>{
  it('requires an authenticated administrator and uses a safe search path',()=>{
    expect(sql).toContain("security definer set search_path=''")
    expect(sql).toContain("public.has_role('ADMIN')")
    expect(sql).toContain("raise exception 'FORBIDDEN'")
  })

  it('returns all assigned roles and records directory access',()=>{
    expect(sql).toContain('array_agg(r.code order by r.code)')
    expect(sql).toContain('array_agg(r.name order by r.code)')
    expect(sql).toContain("'ADMIN_USER_DIRECTORY_VIEWED'")
    expect(sql).toContain('grant execute on function public.get_admin_user_directory() to authenticated')
  })
})

describe('admin member lifecycle',()=>{
  it('auto-refreshes identity after role changes',()=>{
    expect(realtimeSql).toContain('after insert or update or delete on public.user_roles')
    expect(realtimeSql).toContain('alter publication supabase_realtime add table public.profiles')
  })

  it('keeps privileged user creation and suspension in a guarded edge function',()=>{
    expect(adminUserFunction).toContain("caller.rpc('has_role',{p_role:'ADMIN'})")
    expect(adminUserFunction).toContain('Authorization:authHeader')
    expect(adminUserFunction).toContain("if(adminRole!==true)return json({error:'FORBIDDEN'},403)")
    expect(adminUserFunction).toContain("eq('roles.code','ADMIN')")
    expect(adminUserFunction).toContain('inviteUserByEmail')
    expect(adminUserFunction).toContain("action:'USER_INVITED'")
    expect(adminUserFunction).toContain("ban_duration:body.status==='ACTIVE'?'none':'876000h'")
    expect(adminUserFunction).toContain("action:'USER_ACCOUNT_STATUS_UPDATED'")
  })

  it('already creates a profile whenever auth creates a user',()=>{
    expect(foundationSql).toContain('function public.handle_new_user()')
    expect(foundationSql).toContain('trigger on_auth_user_created after insert on auth.users')
    expect(foundationSql).toContain('insert into public.profiles')
  })
})

describe('key request in-app notification migration',()=>{
  it('notifies only authenticated request owners for lifecycle changes',()=>{
    expect(notificationSql).toContain('new.authenticated_user_id is null')
    expect(notificationSql).toContain("'KEY_REQUEST_SUBMITTED'")
    expect(notificationSql).toContain("'KEY_REQUEST_APPROVED'")
    expect(notificationSql).toContain("'KEY_REQUEST_RETURNED'")
    expect(notificationSql).toContain("values(v_notification_id,'IN_APP')")
  })
})

describe('admin user role management migration',()=>{
  it('guards role discovery and updates with the admin role',()=>{
    expect(roleSql.match(/public\.has_role\('ADMIN'\)/g)).toHaveLength(2)
    expect(roleSql).toContain("security definer set search_path=''")
    expect(roleSql).toContain("raise exception 'INVALID_ROLE'")
  })

  it('updates roles transactionally, protects the final admin, and audits changes',()=>{
    expect(roleSql).toContain('delete from public.user_roles where user_id=p_user_id')
    expect(roleSql).toContain('insert into public.user_roles(user_id,role_id,assigned_by)')
    expect(roleSql).toContain("raise exception 'LAST_ADMIN_REQUIRED'")
    expect(roleSql).toContain("'USER_ROLES_UPDATED'")
  })
})
