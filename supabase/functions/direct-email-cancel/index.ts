import {createClient} from 'npm:@supabase/supabase-js@2.57.4'
import {createGmailSelfTestScope} from '../_shared/gmail-self-test-guard.ts'
import {sha256Hex,signGmailKeyActionToken} from '../_shared/gmail-key-action.ts'
import {renderKeyRequestEmail} from '../_shared/email-templates.ts'
import {createDirectEmailCancelHandler} from './core.ts'

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})

Deno.serve(async(req)=>{
 const now=Math.floor(Date.now()/1000);const enabled=Deno.env.get('DIRECT_EMAIL_CANCEL_ENABLED')??'false'
 const url=Deno.env.get('SUPABASE_URL')??'';const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';const secret=Deno.env.get('GMAIL_KEY_ACTION_SECRET')??''
 const allowed=Deno.env.get('RESEND_ALLOWED_RECIPIENT')?.trim().toLowerCase()??'';const resendKey=Deno.env.get('RESEND_API_KEY')??'';const cronSecret=Deno.env.get('CRON_SECRET')??'';const prepSecret=Deno.env.get('DIRECT_EMAIL_CANCEL_PREP_SECRET')??''
 const scope=await createGmailSelfTestScope({deliveryMode:Deno.env.get('EMAIL_DELIVERY_MODE'),enabled,allowedRecipient:allowed,requestIds:Deno.env.get('DIRECT_EMAIL_CANCEL_REQUEST_IDS'),expiresAt:Deno.env.get('DIRECT_EMAIL_CANCEL_EXPIRES_AT'),now})
 if(!url||!serviceKey||secret.length<32||!resendKey||!cronSecret||prepSecret.length<32||!scope)return json({ok:false,error:'DIRECT_CANCEL_DISABLED_OR_INVALID_SCOPE'},503)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}})

 if(req.method==='POST'){
  if(req.headers.get('authorization')!==`Bearer ${prepSecret}`)return json({ok:false,error:'UNAUTHORIZED'},401)
  const{requestId}=await req.json().catch(()=>({})) as{requestId?:string};if(!requestId||!uuid.test(requestId))return json({ok:false,error:'INVALID_REQUEST_ID'},400)
  const recipientDigest=await sha256Hex(allowed);if(!scope.allows(requestId,recipientDigest,now))return json({ok:false,error:'SELF_TEST_SCOPE_DENIED'},403)
  const{data:context,error:contextError}=await db.rpc('get_key_request_email_context',{p_key_request_id:requestId});const item=context?.[0] as{request_code:string;status:string;starts_at:string;ends_at:string;purpose:string;room_name:string}|undefined
  if(contextError||!item)return json({ok:false,error:'KEY_REQUEST_NOT_FOUND'},404)
  if(!['PENDING_APPROVAL','APPROVED','IN_USE'].includes(item.status)||new Date(item.ends_at).getTime()<=Date.now())return json({ok:false,error:'KEY_REQUEST_NOT_CANCELLABLE'},409)
  const{data:outbox,error:outboxError}=await db.rpc('get_direct_cancel_sent_outbox',{p_key_request_id:requestId,p_recipient_email:allowed});const outboxId=(outbox?.[0] as{outbox_id?:string}|undefined)?.outbox_id
  if(outboxError||!outboxId)return json({ok:false,error:'OUTBOX_RECIPIENT_MISMATCH'},403)
  const payload={v:1 as const,jti:outboxId,requestId,action:'CANCEL' as const,recipientDigest,exp:Math.min(scope.expiresAt,Math.floor(new Date(item.ends_at).getTime()/1000)),purpose:'gmail-key-action' as const}
  if(payload.exp<=now)return json({ok:false,error:'ACTION_TOKEN_EXPIRED'},409)
  const rawToken=await signGmailKeyActionToken(payload,secret)
  const{error:tokenError}=await db.rpc('issue_gmail_key_action_token',{p_outbox_id:payload.jti,p_key_request_id:requestId,p_recipient_email:allowed,p_action:'CANCEL',p_expires_at:new Date(payload.exp*1000).toISOString(),p_raw_token:rawToken})
  if(tokenError)return json({ok:false,error:'TOKEN_ISSUE_FAILED'},500)
  const actionUrl=`${url}/functions/v1/direct-email-cancel?token=${encodeURIComponent(rawToken)}`
  const rendered=renderKeyRequestEmail('key-request-submitted',{requestCode:item.request_code,roomName:item.room_name,startsAt:item.starts_at,endsAt:item.ends_at,purpose:item.purpose,status:item.status,links:{track:'',cancel:actionUrl,returnKey:''},gmailAction:null})
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json','Idempotency-Key':`direct-cancel-self-test:${requestId}`},body:JSON.stringify({from:'ITD336 <onboarding@resend.dev>',to:[allowed],subject:`[ทดสอบ] ${rendered.subject}`,html:rendered.html})})
  if(!response.ok)return json({ok:false,error:'EMAIL_SEND_FAILED'},502)
  return json({ok:true,requestId,emailSent:true},200)
 }

 const handler=createDirectEmailCancelHandler({
  secret,
  scopeExpiresAt:scope.expiresAt,
  authorizeScope:async(payload)=>scope.allows(payload.requestId,payload.recipientDigest,Math.floor(Date.now()/1000)),
  consume:async(rawToken,payload)=>{const{data,error}=await db.rpc('consume_gmail_key_action',{p_raw_token:rawToken,p_action:'CANCEL',p_outbox_id:payload.jti,p_key_request_id:payload.requestId,p_recipient_digest:payload.recipientDigest});if(error)throw new Error(error.message);return{requestCode:String(data?.request_code??''),status:String(data?.status??'')}},
  notify:async(correlationId,requestId)=>{
   try{
    const response=await fetch(`${url}/functions/v1/email-worker`,{method:'POST',headers:{authorization:`Bearer ${cronSecret}`,'content-type':'application/json'},body:JSON.stringify({entityId:requestId,templateKey:'key-request-cancelled'})})
    if(!response.ok){
     const workerPayload=await response.json().catch(()=>({})) as{error?:unknown}
     const workerErrorCode=typeof workerPayload.error==='string'&&/^[A-Z0-9_]{1,64}$/.test(workerPayload.error)?workerPayload.error:'UNKNOWN_WORKER_ERROR'
     console.info(JSON.stringify({correlationId,stage:'worker_invocation',resultCode:'http_failed',httpStatus:response.status,errorCode:workerErrorCode}))
     throw new Error('EMAIL_WORKER_INVOCATION_FAILED')
    }
   }catch(error){
    if(error instanceof Error&&error.message==='EMAIL_WORKER_INVOCATION_FAILED')throw error
    const networkErrorType=error instanceof Error?error.name:'UnknownError'
    console.info(JSON.stringify({correlationId,stage:'worker_invocation',resultCode:'network_failed',networkErrorType}))
    throw new Error('EMAIL_WORKER_INVOCATION_FAILED')
   }
  },
  log:(event)=>console.info(JSON.stringify(event)),
 })
 return handler(req)
})
