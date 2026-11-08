import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scheduleSql = readFileSync(join(process.cwd(), 'supabase/migrations/0035_key_request_catalog_schedule.sql'), 'utf8')
const teacherRequestMigrationPath = join(process.cwd(), 'supabase/migrations/0036_teacher_teaching_key_requests.sql')
const teacherRequestSql = existsSync(teacherRequestMigrationPath) ? readFileSync(teacherRequestMigrationPath, 'utf8') : ''
const selfServicePath = join(process.cwd(), 'supabase/migrations/0037_key_request_self_service.sql')
const selfServiceSql = existsSync(selfServicePath) ? readFileSync(selfServicePath, 'utf8') : ''
const legacyHistoryPath = join(process.cwd(), 'supabase/migrations/0038_key_request_history_by_verified_email.sql')
const legacyHistorySql = existsSync(legacyHistoryPath) ? readFileSync(legacyHistoryPath, 'utf8') : ''
const cancellableHistoryPath = join(process.cwd(), 'supabase/migrations/0039_cancellable_key_request_history.sql')
const cancellableHistorySql = existsSync(cancellableHistoryPath) ? readFileSync(cancellableHistoryPath, 'utf8') : ''

describe('key-request room catalog migration', () => {
  it('supplies the required room layout key before conflict resolution', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/0033_key_request_room_catalog_seed.sql'), 'utf8')
    expect(sql).toMatch(/insert into public\.rooms\([^)]*layout_key[^)]*\)/i)
    expect(sql).toMatch(/select c\.code,c\.code,c\.name/i)
  })

  it('keeps public history free of email and identifier fields', () => {
    const history = scheduleSql.slice(scheduleSql.indexOf('create or replace function public.get_public_key_request_history'), scheduleSql.indexOf('create or replace function public.get_public_room_schedule_events'))
    expect(history).toContain('requester_name')
    expect(history).not.toContain('requester_email')
    expect(history).not.toContain('requester_identifier')
    expect(scheduleSql).toContain("limit least(greatest(coalesce(p_limit,10),1),10)")
  })

  it('includes current and past key requests in public history', () => {
    const history = scheduleSql.slice(scheduleSql.indexOf('create or replace function public.get_public_key_request_history'), scheduleSql.indexOf('create or replace function public.get_public_room_schedule_events'))
    expect(history).toContain("r.status in('PENDING_APPROVAL','APPROVED','IN_USE','RETURNED')")
    expect(history).toContain("(r.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date")
  })

  it('blocks today availability with active key requests', () => {
    expect(scheduleSql).toContain('create or replace function public.get_public_room_schedule_events')
    expect(scheduleSql).toContain('from public.key_requests r')
    expect(scheduleSql).toContain("r.status in('PENDING_APPROVAL','APPROVED','IN_USE')")
  })

  it('allows teachers to submit teaching requests without weakening student course validation', () => {
    expect(teacherRequestSql).toContain("p_requester_type='STUDENT' and p_purpose_type='TEACHING'")
    expect(teacherRequestSql).toContain("p_requester_type='TEACHER' and p_purpose_type='TEACHING'")
    expect(teacherRequestSql).toContain("purpose_type<>'TEACHING' or requester_type='TEACHER'")
    expect(teacherRequestSql).toContain('revoke all on function public.create_key_request(')
  })

  it('limits key-request history and cancellation to the authenticated owner', () => {
    expect(selfServiceSql).toContain('auth.uid()')
    expect(selfServiceSql).toContain('authenticated_user_id=v_actor')
    expect(selfServiceSql).toContain("v_request.status not in('PENDING_APPROVAL','APPROVED')")
    expect(selfServiceSql).toContain('set search_path=')
  })

  it('includes unowned legacy requests only for the verified account email', () => {
    expect(legacyHistorySql.indexOf('drop function if exists public.get_my_key_requests()')).toBeLessThan(legacyHistorySql.indexOf('create function public.get_my_key_requests()'))
    expect(legacyHistorySql).toContain('email_confirmed_at is not null')
    expect(legacyHistorySql).toContain('k.authenticated_user_id is null')
    expect(legacyHistorySql).toContain('lower(k.requester_email)=lower(v_email)')
    expect(legacyHistorySql).toContain('k.authenticated_user_id=auth.uid()')
    expect(legacyHistorySql).toContain('can_cancel')
    expect(legacyHistorySql).toContain('set search_path=')
  })

  it('allows cancellation through the end time only for the verified owner', () => {
    expect(cancellableHistorySql).toContain('k.ends_at>now()')
    expect(cancellableHistorySql).toContain("k.status in('PENDING_APPROVAL','APPROVED')")
    expect(cancellableHistorySql).toContain('v_request.ends_at<=now()')
    expect(cancellableHistorySql).toContain('v_request.authenticated_user_id=v_actor')
    expect(cancellableHistorySql).toContain('lower(v_request.requester_email)=lower(v_email)')
    expect(cancellableHistorySql).toContain('join public.room_types rt')
  })
})
