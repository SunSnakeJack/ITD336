import {describe,expect,it,vi} from 'vitest'
import {signGmailKeyActionToken} from '../../../supabase/functions/_shared/gmail-key-action'
import {createDirectEmailReturnHandler} from '../../../supabase/functions/direct-email-return/core'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'

const secret='production-test-secret-at-least-32-chars',now=1_800_000_000
const payload={v:1 as const,jti:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',action:'RETURN' as const,recipientDigest:'a'.repeat(64),exp:now+300,purpose:'gmail-key-action' as const}

describe('direct-email-return',()=>{
 it('consumes one scoped RETURN token from GET',async()=>{
  const token=await signGmailKeyActionToken(payload,secret),consume=vi.fn().mockResolvedValue({requestCode:'KR-1',status:'RETURNED'})
  const handler=createDirectEmailReturnHandler({secret,now:()=>now,scopeExpiresAt:now+600,authorizeScope:vi.fn().mockResolvedValue(true),consume,correlationId:()=> '00000000-0000-4000-8000-000000000099'})
  const response=await handler(new Request(`https://example.test/direct-email-return?token=${token}`))
  expect(response.status).toBe(200);expect(await response.text()).toContain('คืนกุญแจสำเร็จ');expect(consume).toHaveBeenCalledWith(token,payload)
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
 })
 it('rejects invalid, expired, out-of-scope and replayed tokens',async()=>{
  const token=await signGmailKeyActionToken(payload,secret)
  const base={secret,now:()=>now,scopeExpiresAt:now+600,consume:vi.fn()}
  expect((await createDirectEmailReturnHandler({...base,authorizeScope:vi.fn().mockResolvedValue(true)})(new Request('https://example.test/?token=bad'))).status).toBe(401)
  expect((await createDirectEmailReturnHandler({...base,scopeExpiresAt:now,authorizeScope:vi.fn()})(new Request(`https://example.test/?token=${token}`))).status).toBe(401)
  expect((await createDirectEmailReturnHandler({...base,authorizeScope:vi.fn().mockResolvedValue(false)})(new Request(`https://example.test/?token=${token}`))).status).toBe(403)
  expect((await createDirectEmailReturnHandler({...base,authorizeScope:vi.fn().mockResolvedValue(true),consume:vi.fn().mockRejectedValue(new Error('ACTION_TOKEN_ALREADY_USED'))})(new Request(`https://example.test/?token=${token}`))).status).toBe(409)
 })
 it('keeps non-GET requests read-only',async()=>{
  const consume=vi.fn(),handler=createDirectEmailReturnHandler({secret,scopeExpiresAt:now+600,authorizeScope:vi.fn(),consume})
  expect((await handler(new Request('https://example.test/',{method:'POST'}))).status).toBe(405);expect(consume).not.toHaveBeenCalled()
 })
 it('keeps direct RETURN links behind a request-scoped disabled-by-default guard',()=>{
  const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
  expect(worker).toContain("DIRECT_EMAIL_RETURN_ENABLED')==='true'")
  expect(worker).toContain('DIRECT_EMAIL_RETURN_REQUEST_IDS')
  expect(worker).toContain('DIRECT_EMAIL_RETURN_EXPIRES_AT')
  expect(worker).toContain('/functions/v1/direct-email-return?token=')
 })
})
