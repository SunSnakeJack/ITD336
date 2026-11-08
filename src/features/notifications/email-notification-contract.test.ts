import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderKeyRequestEmail } from '../../../supabase/functions/_shared/email-templates'

const migrationPath=join(process.cwd(),'supabase/migrations/0040_key_request_email_notifications.sql')
const sql=existsSync(migrationPath)?readFileSync(migrationPath,'utf8'):''
const accessPath=join(process.cwd(),'supabase/migrations/0041_email_worker_key_request_context.sql')
const accessSql=existsSync(accessPath)?readFileSync(accessPath,'utf8'):''
const tokenFixPath=join(process.cwd(),'supabase/migrations/0042_fix_action_bundle_encode.sql')
const tokenFixSql=existsSync(tokenFixPath)?readFileSync(tokenFixPath,'utf8'):''
const terminalPath=join(process.cwd(),'supabase/migrations/0043_key_request_terminal_email_notifications.sql')
const terminalSql=existsSync(terminalPath)?readFileSync(terminalPath,'utf8'):''

describe('key-request email notifications',()=>{
  it('queues idempotent reminder and expiry jobs only for approved requests',()=>{
    expect(sql).toContain("'key-request:'||new.id||':ending-soon'")
    expect(sql).toContain("'key-request:'||new.id||':ended'")
    expect(sql).toContain("new.status in('APPROVED','IN_USE')")
    expect(sql).toContain("new.ends_at-interval '30 minutes'")
    expect(sql).toContain('on conflict(idempotency_key)')
  })

  it('renders pending, approved, rejected, reminder and ended email variants',()=>{
    const base={requestCode:'KR-1',roomName:'S2407',startsAt:'2026-11-08T10:00:00+07:00',endsAt:'2026-11-08T11:00:00+07:00',purpose:'ทดสอบ',links:{track:'https://example.test/t',cancel:'https://example.test/c',returnKey:'https://example.test/r'}}
    expect(renderKeyRequestEmail('key-request-submitted',{...base,status:'PENDING_APPROVAL'}).subject).toContain('รออนุมัติ')
    expect(renderKeyRequestEmail('key-request-approved',{...base,status:'APPROVED'}).subject).toContain('อนุมัติ')
    expect(renderKeyRequestEmail('key-request-rejected',{...base,status:'REJECTED'}).subject).toContain('ไม่อนุมัติ')
    expect(renderKeyRequestEmail('key-request-ending-soon',{...base,status:'APPROVED'}).subject).toContain('30 นาที')
    expect(renderKeyRequestEmail('key-request-ended',{...base,status:'APPROVED'}).subject).toContain('สิ้นสุด')
    expect(renderKeyRequestEmail('key-request-submitted',{...base,status:'APPROVED'}).html).toContain('ยืนยันคืนกุญแจ')
  })

  it('renders every key-request lifecycle email with Bangkok local time',()=>{
    const base={requestCode:'KR-1',roomName:'S2407',startsAt:'2026-11-08T03:00:00Z',endsAt:'2026-11-08T04:00:00Z',purpose:'ทดสอบ',links:{track:'https://example.test/t',cancel:'https://example.test/c',returnKey:'https://example.test/r'}}
    const cases=[
      ['key-request-submitted','APPROVED','สำเร็จ'],['key-request-submitted','PENDING_APPROVAL','รออนุมัติ'],
      ['key-request-approved','APPROVED','อนุมัติ'],['key-request-rejected','REJECTED','ไม่อนุมัติ'],
      ['key-request-cancelled','CANCELLED','ยกเลิก'],['key-request-returned','RETURNED','คืนกุญแจ'],
      ['key-request-ending-soon','APPROVED','30 นาที'],['key-request-ended','APPROVED','สิ้นสุด'],
    ] as const
    for(const[template,status,subject]of cases){
      const email=renderKeyRequestEmail(template,{...base,status})
      expect(email.subject).toContain(subject)
      expect(email.html).toContain('10:00')
      expect(email.html).toContain('11:00')
      expect(email.html).not.toContain('2026-11-08T03:00:00Z')
    }
  })

  it('queues cancelled and returned notifications idempotently',()=>{
    expect(terminalSql).toContain("'key-request:'||new.id||':cancelled'")
    expect(terminalSql).toContain("'key-request:'||new.id||':returned'")
    expect(terminalSql).toContain('on conflict(idempotency_key) do nothing')
    expect(terminalSql).toContain("new.status='CANCELLED'")
    expect(terminalSql).toContain("new.status='RETURNED'")
  })

  it('keeps the worker in test-recipient mode with Resend idempotency',()=>{
    const workerPath=join(process.cwd(),'supabase/functions/email-worker/index.ts')
    const worker=existsSync(workerPath)?readFileSync(workerPath,'utf8'):''
    expect(worker).toContain("from:'ITD336 <onboarding@resend.dev>'")
    expect(worker).toContain('RESEND_ALLOWED_RECIPIENT')
    expect(worker).toContain("'Idempotency-Key'")
    expect(worker).toContain("mode!=='test'")
  })

  it('requires confirmation before cancel or return token consumption',()=>{
    const actionPath=join(process.cwd(),'supabase/functions/key-request-action/index.ts')
    const action=existsSync(actionPath)?readFileSync(actionPath,'utf8'):''
    expect(action).toContain("req.method==='GET'&&action!=='TRACK'")
    expect(action).toContain('<form method="post">')
    expect(action).toContain("db.rpc('consume_key_request_action'")
    expect(action).toContain("'cache-control':'no-store'")
    const tokenSql=readFileSync(join(process.cwd(),'supabase/migrations/0030_baseline_workflow_functions.sql'),'utf8')
    expect(tokenSql).toContain("v_token.used_at is not null")
    expect(tokenSql).toContain("v_token.expires_at<=now()")
    expect(tokenSql).toContain('ACTION_TOKEN_ALREADY_USED')
    expect(tokenSql).toContain('ACTION_TOKEN_EXPIRED')
  })

  it('gives the worker narrow RPC access without granting the key request table',()=>{
    expect(accessSql).toContain('security definer set search_path=')
    expect(accessSql).toContain("coalesce(auth.role(),'')<>'service_role'")
    expect(accessSql).toContain('grant execute on function public.get_key_request_email_context(uuid) to service_role')
    expect(accessSql).not.toContain('grant select on public.key_requests to service_role')
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    expect(worker).toContain("db.rpc('get_key_request_email_context'")
    expect(worker).not.toContain("from('key_requests')")
  })

  it('uses the PostgreSQL encode function for secure action tokens',()=>{
    expect(tokenFixSql).toContain("pg_catalog.encode(extensions.gen_random_bytes(32),'hex')")
    expect(tokenFixSql).not.toContain('extensions.encode(')
    expect(tokenFixSql).toContain("coalesce(auth.role(),'')<>'service_role'")
    expect(tokenFixSql).toContain('set search_path=')
  })
})
