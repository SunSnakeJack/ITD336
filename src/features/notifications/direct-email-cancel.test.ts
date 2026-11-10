import {describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {signGmailKeyActionToken} from '../../../supabase/functions/_shared/gmail-key-action'
import {createDirectEmailCancelHandler} from '../../../supabase/functions/direct-email-cancel/core'

const secret='direct-cancel-test-secret-at-least-32-chars'
const now=1_800_000_000
const payload={v:1 as const,jti:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',action:'CANCEL' as const,recipientDigest:'a'.repeat(64),exp:now+300,purpose:'gmail-key-action' as const}

describe('direct-email-cancel',()=>{
 it('logs safe worker invocation diagnostics without raw response data',()=>{
  const source=readFileSync(join(process.cwd(),'supabase/functions/direct-email-cancel/index.ts'),'utf8')
  expect(source).toContain('notify:async(correlationId,requestId)')
  expect(source).toContain("stage:'worker_invocation'")
  expect(source).toContain('httpStatus:response.status')
  expect(source).toContain('errorCode:workerErrorCode')
  expect(source).toContain('networkErrorType')
  expect(source).not.toContain('response.text()')
 })
 it('consumes one scoped CANCEL token from GET and sends confirmation',async()=>{
  const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn().mockResolvedValue({requestCode:'KR-1',status:'CANCELLED'});const notify=vi.fn().mockResolvedValue(undefined);const logs:unknown[]=[]
  const handler=createDirectEmailCancelHandler({secret,now:()=>now,scopeExpiresAt:now+600,correlationId:()=> '00000000-0000-4000-8000-000000000099',authorizeScope:vi.fn().mockResolvedValue(true),consume,notify,log:(entry)=>logs.push(entry)})
  const response=await handler(new Request(`https://example.test/direct-email-cancel?token=${encodeURIComponent(token)}`))
  expect(response.status).toBe(200);expect(await response.text()).toContain('ยกเลิกคำขอสำเร็จ');expect(consume).toHaveBeenCalledWith(token,payload);expect(notify).toHaveBeenCalledOnce()
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');expect(response.headers.get('content-disposition')).toBe('inline');expect(response.headers.get('x-correlation-id')).toBe('00000000-0000-4000-8000-000000000099')
  const serialized=JSON.stringify(logs);expect(logs).toContainEqual(expect.objectContaining({stage:'rpc',resultCode:'success',requestId:payload.requestId}));expect(serialized).not.toContain(token);expect(serialized).not.toContain('authorization');expect(serialized).not.toContain('query')
 })

 it('rejects requests outside scope before database mutation',async()=>{
  const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn()
  const handler=createDirectEmailCancelHandler({secret,now:()=>now,scopeExpiresAt:now+600,authorizeScope:vi.fn().mockResolvedValue(false),consume,notify:vi.fn()})
  expect((await handler(new Request(`https://example.test/direct-email-cancel?token=${token}`))).status).toBe(403);expect(consume).not.toHaveBeenCalled()
 })

 it('rejects replay without another confirmation',async()=>{
  const token=await signGmailKeyActionToken(payload,secret);const notify=vi.fn()
  const handler=createDirectEmailCancelHandler({secret,now:()=>now,scopeExpiresAt:now+600,authorizeScope:vi.fn().mockResolvedValue(true),consume:vi.fn().mockRejectedValue(new Error('ACTION_TOKEN_ALREADY_USED')),notify})
  expect((await handler(new Request(`https://example.test/direct-email-cancel?token=${token}`))).status).toBe(409);expect(notify).not.toHaveBeenCalled()
 })

 it('logs TTL rejection separately and does not call RPC',async()=>{
  const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn();const logs:unknown[]=[]
  const handler=createDirectEmailCancelHandler({secret,now:()=>now,scopeExpiresAt:now,authorizeScope:vi.fn(),consume,notify:vi.fn(),log:(entry)=>logs.push(entry)})
  expect((await handler(new Request(`https://example.test/direct-email-cancel?token=${token}`))).status).toBe(401);expect(consume).not.toHaveBeenCalled();expect(JSON.stringify(logs)).toContain('ttl_expired')
 })

 it('keeps preparation cron-authenticated, scoped and idempotent',()=>{
  const index=readFileSync(join(process.cwd(),'supabase/functions/direct-email-cancel/index.ts'),'utf8')
  const sql=readFileSync(join(process.cwd(),'supabase/migrations/0048_direct_cancel_sent_outbox_rpc.sql'),'utf8')
  expect(index).toContain('DIRECT_EMAIL_CANCEL_ENABLED')
  expect(index).toContain('DIRECT_EMAIL_CANCEL_REQUEST_IDS')
  expect(index).toContain('DIRECT_EMAIL_CANCEL_EXPIRES_AT')
  expect(index).toContain('RESEND_ALLOWED_RECIPIENT')
  expect(index).toContain('DIRECT_EMAIL_CANCEL_PREP_SECRET')
  expect(index).toContain('CRON_SECRET')
  expect(index).toContain("db.rpc('get_direct_cancel_sent_outbox'")
  expect(index).not.toContain("from('notification_outbox')")
  expect(index).toContain("db.rpc('issue_gmail_key_action_token'")
  expect(index).toContain("'Idempotency-Key':`direct-cancel-self-test:${requestId}`")
  expect(sql).toContain("security definer set search_path='' stable")
  expect(sql).toContain("auth.role(),'')<>'service_role'")
  expect(sql).toContain("o.status='SENT'")
  expect(sql).toContain("o.template_key='key-request-submitted'")
  expect(sql).toContain('returns table(outbox_id uuid)')
  expect(sql).toContain('grant execute on function public.get_direct_cancel_sent_outbox(uuid,text) to service_role')
  expect(sql).toContain('revoke all on function public.get_direct_cancel_sent_outbox(uuid,text) from public,anon,authenticated')
 })
})
