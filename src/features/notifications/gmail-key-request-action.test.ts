import {describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {signGmailKeyActionToken} from '../../../supabase/functions/_shared/gmail-key-action'
import {createGmailKeyRequestActionHandler} from '../../../supabase/functions/gmail-key-request-action/core'
import {createGmailSelfTestScope} from '../../../supabase/functions/_shared/gmail-self-test-guard'

const secret='production-test-secret-at-least-32-chars'
const now=1_800_000_000
const payload={v:1 as const,jti:'00000000-0000-4000-8000-000000000001',requestId:'00000000-0000-4000-8000-000000000002',action:'CANCEL' as const,recipientDigest:'a'.repeat(64),exp:now+300,purpose:'gmail-key-action' as const}

async function request(token:string,authorization='Bearer google-token',method='POST'){
  return new Request(`https://example.test/gmail-key-request-action?token=${encodeURIComponent(token)}`,{method,headers:{authorization,'content-type':'application/x-www-form-urlencoded'},body:method==='POST'?'':undefined})
}

describe('gmail-key-request-action',()=>{
  it('limits self-test actions to the allowed recipient, request ids and backend expiration',async()=>{
    const scope=await createGmailSelfTestScope({
      deliveryMode:'test',enabled:'true',allowedRecipient:'owner@example.com',
      requestIds:payload.requestId,expiresAt:String(now+60),now,
    })
    expect(scope?.allows(payload.requestId,await scope.digestRecipient('owner@example.com'))).toBe(true)
    expect(scope?.allows('00000000-0000-4000-8000-000000000099',payload.recipientDigest)).toBe(false)
    expect(await createGmailSelfTestScope({deliveryMode:'test',enabled:'true',allowedRecipient:'owner@example.com',requestIds:payload.requestId,expiresAt:String(now),now})).toBeNull()
    expect(await createGmailSelfTestScope({deliveryMode:'test',enabled:'true',allowedRecipient:'owner@example.com',requestIds:payload.requestId,expiresAt:String(now+3601),now})).toBeNull()
  })
  it('uses an isolated atomic token contract and existing business RPC',()=>{
    const sql=readFileSync(join(process.cwd(),'supabase/migrations/0047_gmail_key_request_actions.sql'),'utf8')
    expect(sql).toContain('create table public.gmail_key_action_tokens')
    expect(sql).toContain('recipient_email_digest')
    expect(sql).toContain('for update')
    expect(sql).toContain('public.consume_key_request_action(p_raw_token,p_action)')
    expect(sql).toContain('grant execute on function public.consume_gmail_key_action')
    expect(sql).not.toContain('grant select on public.gmail_key_action_tokens')
  })

  it('keeps Gmail markup behind a disabled-by-default feature flag',()=>{
    const worker=readFileSync(join(process.cwd(),'supabase/functions/email-worker/index.ts'),'utf8')
    const action=readFileSync(join(process.cwd(),'supabase/functions/gmail-key-request-action/index.ts'),'utf8')
    const template=readFileSync(join(process.cwd(),'supabase/functions/_shared/email-templates.ts'),'utf8')
    expect(worker).toContain("GMAIL_KEY_ACTION_ENABLED')==='true'")
    expect(worker).toContain("issue_gmail_key_action_token")
    expect(template).toContain('application/ld+json')
    expect(template).toContain('HttpActionHandler')
    expect(template).toContain('HttpRequestMethod/POST')
    for(const source of[worker,action]){
      expect(source).toContain('GMAIL_KEY_ACTION_TEST_REQUEST_IDS')
      expect(source).toContain('GMAIL_KEY_ACTION_TEST_EXPIRES_AT')
      expect(source).toContain('createGmailSelfTestScope')
    }
    expect(action).toContain('authorizeScope')
    expect(worker).toContain('gmailScope?.allows')
  })

  it('verifies the Google bearer signature, issuer, audience and Gmail caller',()=>{
    const index=readFileSync(join(process.cwd(),'supabase/functions/gmail-key-request-action/index.ts'),'utf8')
    expect(index).toContain('createRemoteJWKSet')
    expect(index).toContain('jwtVerify')
    expect(index).toContain('https://accounts.google.com')
    expect(index).toContain('GMAIL_ACTION_AUDIENCE')
    expect(index).toContain('gmail@system.gserviceaccount.com')
    expect(index).toContain('payload.email_verified===true')
    expect(index).toContain("GMAIL_KEY_ACTION_ENABLED')!=='true'")
  })
  it('verifies Google bearer and atomically consumes a signed CANCEL token',async()=>{
    const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn().mockResolvedValue({requestCode:'KR-1',status:'CANCELLED'});const notify=vi.fn().mockResolvedValue(undefined)
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn().mockResolvedValue(true),authorizeScope:vi.fn().mockResolvedValue(true),consume,notify})
    const response=await handler(await request(token))
    expect(response.status).toBe(200)
    expect(consume).toHaveBeenCalledWith(token,payload)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('rejects a valid token outside the server-side self-test scope before database mutation',async()=>{
    const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn();const notify=vi.fn()
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn().mockResolvedValue(true),authorizeScope:vi.fn().mockResolvedValue(false),consume,notify})
    expect((await handler(await request(token))).status).toBe(403)
    expect(consume).not.toHaveBeenCalled();expect(notify).not.toHaveBeenCalled()
  })

  it('fails closed when the action scope authorizer is not configured',async()=>{
    const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn()
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn().mockResolvedValue(true),consume,notify:vi.fn()})
    expect((await handler(await request(token))).status).toBe(403);expect(consume).not.toHaveBeenCalled()
  })

  it('rejects missing or invalid Google bearer before consuming token',async()=>{
    const token=await signGmailKeyActionToken(payload,secret);const consume=vi.fn()
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn().mockResolvedValue(false),consume,notify:vi.fn()})
    expect((await handler(await request(token))).status).toBe(401)
    expect(consume).not.toHaveBeenCalled()
  })

  it('rejects tampered and expired action tokens',async()=>{
    const valid=await signGmailKeyActionToken(payload,secret);const consume=vi.fn();const verifyGoogleBearer=vi.fn().mockResolvedValue(true)
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer,consume,notify:vi.fn()})
    expect((await handler(await request(valid.slice(0,-1)+'x'))).status).toBe(401)
    expect((await handler(await request(await signGmailKeyActionToken({...payload,jti:'expired',exp:now-1},secret)))).status).toBe(401)
    expect(consume).not.toHaveBeenCalled()
  })

  it('keeps GET read-only',async()=>{
    const consume=vi.fn();const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn(),consume,notify:vi.fn()})
    expect((await handler(await request('unused','Bearer google-token','GET'))).status).toBe(405)
    expect(consume).not.toHaveBeenCalled()
  })

  it('returns a replay conflict without sending a result email',async()=>{
    const token=await signGmailKeyActionToken(payload,secret);const notify=vi.fn()
    const handler=createGmailKeyRequestActionHandler({secret,now:()=>now,verifyGoogleBearer:vi.fn().mockResolvedValue(true),authorizeScope:vi.fn().mockResolvedValue(true),consume:vi.fn().mockRejectedValue(new Error('ACTION_TOKEN_ALREADY_USED')),notify})
    expect((await handler(await request(token))).status).toBe(409)
    expect(notify).not.toHaveBeenCalled()
  })
})
