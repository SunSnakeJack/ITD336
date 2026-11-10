import {describe,expect,it,vi} from 'vitest'
import {createGmailActionHandler,MemoryReplayStore,signTestToken} from '../../../supabase/functions/gmail-action-test/core'

const secret='test-secret-at-least-32-characters-long'
const now=1_800_000_000
const gmailRequest=(token:string,method='POST')=>new Request(`https://example.test/gmail-action-test?token=${encodeURIComponent(token)}`,{method,headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/1.0 (KHTML, like Gecko; Gmail Actions)'},body:method==='POST'?'confirmed=Approved':undefined})

describe('gmail-action-test',()=>{
  it('accepts one valid Gmail ConfirmAction POST',async()=>{
    const token=await signTestToken({jti:'one',exp:now+60,purpose:'gmail-action-test'},secret)
    const log=vi.fn();const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore(),log})
    const response=await handler(gmailRequest(token))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ok:true})
    expect(log).toHaveBeenCalledWith('gmail_action_test_body:mime=application/x-www-form-urlencoded;bytes=18;fields=confirmed;empty=false;body_used_before=false')
    expect(log).toHaveBeenCalledWith('gmail_action_test_success')
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
  })

  it('accepts one authenticated empty Gmail POST once',async()=>{
    const token=await signTestToken({jti:'empty',exp:now+60,purpose:'gmail-action-test'},secret)
    const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore()})
    const request=()=>new Request(`https://example.test/gmail-action-test?token=${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Gmail Actions'},body:''})
    expect((await handler(request())).status).toBe(200)
    expect((await handler(request())).status).toBe(400)
  })

  it('rejects an invalid token',async()=>{
    const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore()})
    expect((await handler(gmailRequest('invalid.token'))).status).toBe(401)
  })

  it('rejects a token with a modified signature',async()=>{
    const token=await signTestToken({jti:'tampered',exp:now+60,purpose:'gmail-action-test'},secret)
    const tampered=token.slice(0,-1)+(token.endsWith('a')?'b':'a')
    const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore()})
    expect((await handler(gmailRequest(tampered))).status).toBe(401)
  })

  it('rejects an expired token',async()=>{
    const token=await signTestToken({jti:'expired',exp:now-1,purpose:'gmail-action-test'},secret)
    const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore()})
    expect((await handler(gmailRequest(token))).status).toBe(401)
  })

  it('rejects replay of a used token',async()=>{
    const token=await signTestToken({jti:'replay',exp:now+60,purpose:'gmail-action-test'},secret)
    const log=vi.fn();const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore(),log})
    expect((await handler(gmailRequest(token))).status).toBe(200)
    expect((await handler(gmailRequest(token))).status).toBe(400)
    expect(log).toHaveBeenLastCalledWith('gmail_action_test_rejected:token_already_used')
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
  })

  it('logs a safe reason when ConfirmAction body is missing',async()=>{
    const token=await signTestToken({jti:'missing-body',exp:now+60,purpose:'gmail-action-test'},secret)
    const log=vi.fn();const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore(),log})
    const request=new Request(`https://example.test/gmail-action-test?token=${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded; charset=UTF-8','user-agent':'Gmail Actions'},body:'other=value'})
    expect((await handler(request)).status).toBe(400)
    expect(log).toHaveBeenCalledWith('gmail_action_test_body:mime=application/x-www-form-urlencoded;bytes=11;fields=none;empty=false;body_used_before=false')
    expect(log).toHaveBeenCalledWith('gmail_action_test_rejected:missing_confirmed')
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
  })

  it('reports safely when the request body was already consumed',async()=>{
    const token=await signTestToken({jti:'consumed',exp:now+60,purpose:'gmail-action-test'},secret)
    const log=vi.fn();const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore(),log})
    const request=gmailRequest(token)
    await request.text()
    expect((await handler(request)).status).toBe(400)
    expect(log).toHaveBeenCalledWith('gmail_action_test_body:mime=application/x-www-form-urlencoded;bytes=unknown;fields=none;empty=unknown;body_used_before=true')
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
  })

  it('rejects a confirmed value other than Approved',async()=>{
    const token=await signTestToken({jti:'wrong-confirmed',exp:now+60,purpose:'gmail-action-test'},secret)
    const log=vi.fn();const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore(),log})
    const request=new Request(`https://example.test/gmail-action-test?token=${encodeURIComponent(token)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'Gmail Actions'},body:'confirmed=Rejected'})
    expect((await handler(request)).status).toBe(400)
    expect(log).toHaveBeenCalledWith('gmail_action_test_rejected:invalid_confirmed_value')
    expect(JSON.stringify(log.mock.calls)).not.toContain(token)
  })

  it('rejects unsupported HTTP methods',async()=>{
    const handler=createGmailActionHandler({secret,now:()=>now,replayStore:new MemoryReplayStore()})
    const response=await handler(gmailRequest('unused','GET'))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})
