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
const dispatchPath=join(process.cwd(),'supabase/migrations/0044_test_email_entity_dispatch.sql')
const dispatchSql=existsSync(dispatchPath)?readFileSync(dispatchPath,'utf8'):''
const secureDispatchPath=join(process.cwd(),'supabase/migrations/0045_secure_email_entity_dispatch.sql')
const secureDispatchSql=existsSync(secureDispatchPath)?readFileSync(secureDispatchPath,'utf8'):''
const scopedRetryPath=join(process.cwd(),'supabase/migrations/0049_scoped_terminal_email_retry.sql')
const scopedRetrySql=existsSync(scopedRetryPath)?readFileSync(scopedRetryPath,'utf8'):''

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

  it('renders only cancel and return actions without a tracking action',()=>{
    const email=renderKeyRequestEmail('key-request-submitted',{requestCode:'KR-1',roomName:'S2407',startsAt:'2026-11-08T10:00:00+07:00',endsAt:'2026-11-08T11:00:00+07:00',purpose:'ทดสอบ',status:'APPROVED',links:{track:'https://example.test/t',cancel:'https://example.test/c',returnKey:'https://example.test/r'}})
    expect(email.html).toContain('ยกเลิกคำขอ')
    expect(email.html).toContain('ยืนยันคืนกุญแจ')
    expect(email.html).not.toContain('ติดตามสถานะ')
    expect(email.html).not.toContain('https://example.test/t')
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
    expect(worker).toContain("from:delivery.from")
    expect(worker).toContain('RESEND_ALLOWED_RECIPIENT')
    expect(worker).toContain("'Idempotency-Key'")
    expect(worker).toContain("mode==='production'&&!cronAuthorized")
    expect(worker).toContain('PUBLIC_SITE_URL')
    expect(worker).toContain('/key-request-action?action=')
    expect(worker).not.toContain('/functions/v1/key-request-action?')
  })

  it('dispatches only the newly-created request outbox when cron is disabled',()=>{
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    const service=readFileSync(join(process.cwd(),'src/features/keys/key.service.ts'),'utf8')
    expect(worker).toContain("db.rpc('claim_notification_outbox_entity_test'")
    expect(worker).toContain('entityId')
    expect(worker).toContain('dispatchToken')
    expect(service).toContain("supabase.functions.invoke('email-worker'")
    expect(service).toContain('dispatchToken:result.email_dispatch_token')
    expect(dispatchSql).toContain('p_entity_id uuid')
    expect(dispatchSql).toContain("entity_type='key_request'")
    expect(dispatchSql).toContain('entity_id=p_entity_id')
    expect(dispatchSql).toContain("coalesce(auth.role(),'')<>'service_role'")
    expect(worker).toContain('const siteUrl=publicSiteUrl')
    expect(worker).not.toContain('isLoopbackOrigin')
    expect(worker).not.toContain("req.headers.get('origin')")
    expect(worker).not.toContain("link('TRACK'")
    expect(worker).toContain("req.method==='OPTIONS'")
    expect(worker).toContain("'access-control-allow-origin':'*'")
    expect(secureDispatchSql).toContain('p_dispatch_token text')
    expect(secureDispatchSql).toContain('email_dispatch_tokens')
    expect(secureDispatchSql).toContain('ACTION_TOKEN_ALREADY_USED')
    expect(secureDispatchSql).toContain('ACTION_TOKEN_EXPIRED')
    expect(secureDispatchSql).toContain("'email_dispatch_token',v_dispatch_token")
  })

  it('sends terminal confirmation emails without requiring a public site URL',()=>{
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    expect(worker).toContain("!booking&&!['key-request-admin-notice','key-request-overdue','key-request-rejected','key-request-lecturer-notice','key-request-cancelled','key-request-returned','key-request-ended'].includes(row.template_key)")
    expect(worker).toContain("if(actionBundleRequired&&!siteUrl)throw new Error('PUBLIC_SITE_URL_REQUIRED')")
    expect(worker).not.toContain('if(!url||!serviceKey||!resendKey||!siteUrl)')
  })

  it('claims one terminal confirmation outbox atomically for a service-role scoped retry',()=>{
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    expect(scopedRetrySql).toContain('create or replace function public.claim_terminal_notification_outbox_retry')
    expect(scopedRetrySql).toContain("p_template_key not in('key-request-cancelled','key-request-returned')")
    expect(scopedRetrySql).toContain('for update skip locked limit 1')
    expect(scopedRetrySql).toContain("coalesce(auth.role(),'')<>'service_role'")
    expect(scopedRetrySql).toContain('grant execute on function public.claim_terminal_notification_outbox_retry(text,text,uuid,text) to service_role')
    expect(scopedRetrySql).not.toContain('to anon')
    expect(scopedRetrySql).not.toContain('to authenticated')
    expect(worker).toContain("db.rpc('claim_terminal_notification_outbox_retry'")
    expect(worker).toContain("templateKey==='key-request-cancelled'||templateKey==='key-request-returned'")
    const direct=readFileSync(join(process.cwd(),'supabase/functions/direct-email-cancel/index.ts'),'utf8')
    expect(direct).toContain("body:JSON.stringify({entityId:requestId,templateKey:'key-request-cancelled'})")
  })

  it('requires confirmation before cancel or return token consumption',()=>{
    const actionPath=join(process.cwd(),'supabase/functions/key-request-action/index.ts')
    const action=existsSync(actionPath)?readFileSync(actionPath,'utf8'):''
    expect(action).toContain("req.method!=='POST'")
    expect(action).toContain("req.method==='OPTIONS'")
    expect(action).toContain("db.rpc('consume_key_request_action'")
    expect(action).toContain("'access-control-allow-origin':'*'")
    expect(action).not.toContain('<form method="post">')
    const tokenSql=readFileSync(join(process.cwd(),'supabase/migrations/0030_baseline_workflow_functions.sql'),'utf8')
    expect(tokenSql).toContain("v_token.used_at is not null")
    expect(tokenSql).toContain("v_token.expires_at<=now()")
    expect(tokenSql).toContain('ACTION_TOKEN_ALREADY_USED')
    expect(tokenSql).toContain('ACTION_TOKEN_EXPIRED')
    expect(action).toContain('ACTION_TOKEN_ALREADY_USED')
    expect(action).toContain('KEY_REQUEST_NOT_CANCELLABLE')
    expect(action).toContain('KEY_REQUEST_NOT_RETURNABLE')
    expect(action).toContain('คำขอนี้ถูกยกเลิกแล้วหรือไม่อยู่ในสถานะที่ยกเลิกได้')
    expect(action).toContain('คำขอนี้ยังไม่อยู่ในสถานะที่คืนกุญแจได้')
  })

  it('does not grant request cancellation authority to lecturer notices',()=>{
    const base={requestCode:'KR-1',roomName:'S2407',startsAt:'2026-11-08T03:00:00Z',endsAt:'2026-11-08T04:00:00Z',purpose:'ทดสอบ',status:'APPROVED',links:{track:'https://example.test/t',cancel:'https://example.test/c',returnKey:'https://example.test/r'}}
    const email=renderKeyRequestEmail('key-request-lecturer-notice',base)
    expect(email.html).not.toContain('ยกเลิกคำขอ')
    expect(email.html).not.toContain('https://example.test/c')
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    expect(worker).toContain("!booking&&!['key-request-admin-notice','key-request-overdue','key-request-rejected','key-request-lecturer-notice','key-request-cancelled','key-request-returned','key-request-ended'].includes(row.template_key)")
    expect(worker).toContain('actionBundleRequired')
  })

  it('preserves cancellation history and releases the request time range',()=>{
    const workflowSql=readFileSync(join(process.cwd(),'supabase/migrations/0030_baseline_workflow_functions.sql'),'utf8')
    const schemaSql=readFileSync(join(process.cwd(),'supabase/migrations/0029_baseline_request_schema.sql'),'utf8')
    expect(workflowSql).toContain("set_config('app.key_request_actor_kind','TOKEN',true)")
    expect(workflowSql).toContain("update public.key_requests set status='CANCELLED',cancelled_at=now()")
    expect(workflowSql).toContain("v_request.status not in('PENDING_APPROVAL','APPROVED','IN_USE')")
    expect(schemaSql).toContain("where (status in ('PENDING_APPROVAL','APPROVED','IN_USE'))")
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
