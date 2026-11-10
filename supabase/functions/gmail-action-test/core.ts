export interface TestTokenPayload{jti:string;exp:number;purpose:'gmail-action-test'}
export interface ReplayStore{consume(jti:string,expiresAt:number,now:number):boolean|Promise<boolean>}

const encoder=new TextEncoder()
const base64UrlEncode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const base64UrlDecode=(value:string)=>{
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)
  return Uint8Array.from(atob(padded),(char)=>char.charCodeAt(0))
}
const hmacKey=(secret:string,usage:KeyUsage[])=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,usage)

export async function signTestToken(payload:TestTokenPayload,secret:string){
  const encoded=base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const key=await hmacKey(secret,['sign'])
  const signature=await crypto.subtle.sign('HMAC',key,encoder.encode(encoded))
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function verifyTestToken(token:string,secret:string,now:number):Promise<TestTokenPayload|null>{
  try{
    const[encoded,signature,...rest]=token.split('.')
    if(!encoded||!signature||rest.length)return null
    const key=await hmacKey(secret,['verify'])
    if(!await crypto.subtle.verify('HMAC',key,base64UrlDecode(signature),encoder.encode(encoded)))return null
    const payload=JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as Partial<TestTokenPayload>
    if(payload.purpose!=='gmail-action-test'||typeof payload.jti!=='string'||!payload.jti||payload.jti.length>128||typeof payload.exp!=='number'||!Number.isInteger(payload.exp))return null
    if(payload.exp<=now||payload.exp>now+900)return null
    return payload as TestTokenPayload
  }catch{return null}
}

export class MemoryReplayStore implements ReplayStore{
  private readonly used=new Map<string,number>()
  consume(jti:string,expiresAt:number,now:number){
    for(const[id,expiry]of this.used)if(expiry<=now)this.used.delete(id)
    if(this.used.has(jti))return false
    this.used.set(jti,expiresAt)
    return true
  }
}

interface HandlerOptions{secret:string;now?:()=>number;replayStore:ReplayStore;log?:(event:string)=>void}
const json=(body:unknown,status:number,extra:HeadersInit={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...extra}})

export function createGmailActionHandler({secret,now=()=>Math.floor(Date.now()/1000),replayStore,log}:HandlerOptions){
  return async(req:Request)=>{
    if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,{allow:'POST'})
    if(!req.headers.get('user-agent')?.includes('Gmail Actions'))return json({ok:false,error:'INVALID_GMAIL_REQUEST'},401)
    const mime=(req.headers.get('content-type')??'').split(';',1)[0].trim().toLowerCase()
    if(mime!=='application/x-www-form-urlencoded'){log?.(`gmail_action_test_body:mime=${mime||'missing'};bytes=unknown;fields=none;empty=unknown;body_used_before=${req.bodyUsed}`);log?.('gmail_action_test_rejected:invalid_content_type');return json({ok:false,error:'INVALID_CONTENT_TYPE'},400)}
    const current=now();const token=new URL(req.url).searchParams.get('token')??''
    const payload=await verifyTestToken(token,secret,current)
    if(!payload)return json({ok:false,error:'INVALID_OR_EXPIRED_TOKEN'},401)
    const bodyUsedBefore=req.bodyUsed
    if(bodyUsedBefore){log?.(`gmail_action_test_body:mime=${mime};bytes=unknown;fields=none;empty=unknown;body_used_before=true`);return json({ok:false,error:'BODY_ALREADY_READ'},400)}
    const raw=await req.clone().text()
    let form:FormData
    try{form=await req.formData()}catch{log?.(`gmail_action_test_body:mime=${mime};bytes=${encoder.encode(raw).byteLength};fields=none;empty=${raw.length===0};body_used_before=false`);log?.('gmail_action_test_rejected:invalid_form_body');return json({ok:false,error:'INVALID_CONFIRM_ACTION'},400)}
    const safeFields=form.has('confirmed')?'confirmed':'none'
    log?.(`gmail_action_test_body:mime=${mime};bytes=${encoder.encode(raw).byteLength};fields=${safeFields};empty=${raw.length===0};body_used_before=false`)
    if(raw.length>0){
      const confirmed=form.get('confirmed')
      if(confirmed===null||confirmed===''){log?.('gmail_action_test_rejected:missing_confirmed');return json({ok:false,error:'INVALID_CONFIRM_ACTION'},400)}
      if(confirmed!=='Approved'){log?.('gmail_action_test_rejected:invalid_confirmed_value');return json({ok:false,error:'INVALID_CONFIRM_ACTION'},400)}
    }
    if(!await replayStore.consume(payload.jti,payload.exp,current)){log?.('gmail_action_test_rejected:token_already_used');return json({ok:false,error:'TOKEN_ALREADY_USED'},400)}
    log?.('gmail_action_test_success')
    return json({ok:true},200)
  }
}
