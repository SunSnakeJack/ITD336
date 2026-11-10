import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { renderKeyRequestEmail } from '../_shared/email-templates.ts'
import {sha256Hex,signGmailKeyActionToken,type GmailKeyAction} from '../_shared/gmail-key-action.ts'
import {createGmailSelfTestScope} from '../_shared/gmail-self-test-guard.ts'

type OutboxRow={id:string;entity_id:string;recipient_email:string;template_key:string;payload:Record<string,unknown>;idempotency_key:string}
type RequestRow={request_code:string;status:string;starts_at:string;ends_at:string;purpose:string;decision_reason:string|null;room_name:string}
const corsHeaders={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders})
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
 const mode=Deno.env.get('EMAIL_DELIVERY_MODE')??'test';const allowed=Deno.env.get('RESEND_ALLOWED_RECIPIENT')?.trim().toLowerCase();const cronSecret=Deno.env.get('CRON_SECRET')
 const gmailEnabled=Deno.env.get('GMAIL_KEY_ACTION_ENABLED')==='true';const gmailSecret=Deno.env.get('GMAIL_KEY_ACTION_SECRET')??''
 const directReturnEnabled=Deno.env.get('DIRECT_EMAIL_RETURN_ENABLED')==='true'
 if(mode!=='test')return json({error:'VERIFIED_DOMAIN_REQUIRED'},503)
 if(!allowed)return json({error:'RESEND_ALLOWED_RECIPIENT_REQUIRED'},503)
 const gmailScope=gmailEnabled?await createGmailSelfTestScope({deliveryMode:mode,enabled:'true',allowedRecipient:allowed,requestIds:Deno.env.get('GMAIL_KEY_ACTION_TEST_REQUEST_IDS'),expiresAt:Deno.env.get('GMAIL_KEY_ACTION_TEST_EXPIRES_AT'),now:Math.floor(Date.now()/1000)}):null
 const directReturnScope=directReturnEnabled?await createGmailSelfTestScope({deliveryMode:mode,enabled:'true',allowedRecipient:allowed,requestIds:Deno.env.get('DIRECT_EMAIL_RETURN_REQUEST_IDS'),expiresAt:Deno.env.get('DIRECT_EMAIL_RETURN_EXPIRES_AT'),now:Math.floor(Date.now()/1000)}):null
 if(gmailEnabled&&!gmailScope)return json({error:'GMAIL_SELF_TEST_SCOPE_INVALID'},503)
 if(directReturnEnabled&&!directReturnScope)return json({error:'DIRECT_RETURN_SCOPE_INVALID'},503)
 const cronAuthorized=Boolean(cronSecret)&&req.headers.get('authorization')===`Bearer ${cronSecret}`
 const body=await req.json().catch(()=>({})) as{entityId?:string;dispatchToken?:string;templateKey?:string};const entityId=body.entityId?.trim()??'';const dispatchToken=body.dispatchToken??'';const templateKey=body.templateKey??''
 if(!cronAuthorized&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)||dispatchToken.length<32))return json({error:'INVALID_ENTITY_DISPATCH'},400)
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const resendKey=Deno.env.get('RESEND_API_KEY');const publicSiteUrl=Deno.env.get('PUBLIC_SITE_URL')?.replace(/\/$/,'');const siteUrl=publicSiteUrl
 if(!url||!serviceKey||!resendKey)return json({error:'WORKER_CONFIGURATION_MISSING'},503)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});const workerId=`email-worker-${crypto.randomUUID()}`
 const scopedRetry=cronAuthorized&&uuid.test(entityId)&&(templateKey==='key-request-cancelled'||templateKey==='key-request-returned')
 const claim=scopedRetry
  ?db.rpc('claim_terminal_notification_outbox_retry',{p_worker_id:workerId,p_recipient:allowed,p_entity_id:entityId,p_template_key:templateKey})
  :cronAuthorized?db.rpc('claim_notification_outbox_test',{p_worker_id:workerId,p_recipient:allowed,p_limit:20})
  :db.rpc('claim_notification_outbox_entity_test',{p_worker_id:workerId,p_recipient:allowed,p_entity_id:entityId,p_dispatch_token:dispatchToken,p_limit:10})
 const{data:claimed,error:claimError}=await claim
 if(claimError)return json({error:'CLAIM_FAILED',detail:claimError.message},500)
 let sent=0,failed=0
 for(const row of(claimed??[]) as OutboxRow[]){
  try{
   const{data:context,error:requestError}=await db.rpc('get_key_request_email_context',{p_key_request_id:row.entity_id})
   const item=(context?.[0]??null) as RequestRow|null
   if(requestError||!item)throw new Error(requestError?.message??'KEY_REQUEST_NOT_FOUND')
   const actionBundleRequired=!['key-request-lecturer-notice','key-request-cancelled','key-request-returned','key-request-ended'].includes(row.template_key);let links={track:'',cancel:'',returnKey:''}
   if(actionBundleRequired){
    if(actionBundleRequired&&!siteUrl)throw new Error('PUBLIC_SITE_URL_REQUIRED')
    const expiresAt=new Date(new Date(item.ends_at).getTime()+86_400_000).toISOString()
    const{data:bundle,error:tokenError}=await db.rpc('issue_key_request_action_bundle',{p_key_request_id:row.entity_id,p_expires_at:expiresAt})
    if(tokenError||!bundle)throw new Error(tokenError?.message??'TOKEN_ISSUE_FAILED')
    const link=(action:string,token:string)=>`${siteUrl}/key-request-action?action=${action}&token=${encodeURIComponent(token)}`
    links={track:'',cancel:link('CANCEL',bundle.cancel_token),returnKey:link('RETURN',bundle.return_token)}
   }
   const directReturnTemplate=['key-request-submitted','key-request-approved','key-request-ending-soon'].includes(row.template_key)
   const directReturnDigest=directReturnTemplate?await sha256Hex(row.recipient_email):''
   if(directReturnEnabled&&directReturnTemplate&&directReturnScope?.allows(row.entity_id,directReturnDigest,Math.floor(Date.now()/1000))){
    if(gmailSecret.length<32)throw new Error('DIRECT_RETURN_CONFIGURATION_MISSING')
    const expiresAt=Math.min(Math.floor((new Date(item.ends_at).getTime()+86_400_000)/1000),directReturnScope.expiresAt)
    const payload={v:1 as const,jti:row.id,requestId:row.entity_id,action:'RETURN' as const,recipientDigest:directReturnDigest,exp:expiresAt,purpose:'gmail-key-action' as const}
    const rawToken=await signGmailKeyActionToken(payload,gmailSecret)
    const{error:returnTokenError}=await db.rpc('issue_gmail_key_action_token',{p_outbox_id:row.id,p_key_request_id:row.entity_id,p_recipient_email:row.recipient_email,p_action:'RETURN',p_expires_at:new Date(expiresAt*1000).toISOString(),p_raw_token:rawToken})
    if(returnTokenError)throw new Error(returnTokenError.message)
    links.returnKey=`${url}/functions/v1/direct-email-return?token=${encodeURIComponent(rawToken)}`
   }
   let gmailAction:null|{name:string;url:string}=null
   const gmailActionType:GmailKeyAction|null=['key-request-ending-soon','key-request-ended'].includes(row.template_key)?'RETURN':['key-request-submitted','key-request-approved'].includes(row.template_key)?'CANCEL':null
   const recipientDigest=gmailActionType?await sha256Hex(row.recipient_email):''
   if(gmailEnabled&&actionBundleRequired&&gmailActionType&&gmailScope?.allows(row.entity_id,recipientDigest,Math.floor(Date.now()/1000))){
    if(gmailSecret.length<32)throw new Error('GMAIL_KEY_ACTION_CONFIGURATION_MISSING')
    const expiresAt=Math.min(Math.floor((new Date(item.ends_at).getTime()+86_400_000)/1000),gmailScope.expiresAt);const recipientDigest=await sha256Hex(row.recipient_email)
    const payload={v:1 as const,jti:row.id,requestId:row.entity_id,action:gmailActionType,recipientDigest,exp:expiresAt,purpose:'gmail-key-action' as const}
    const rawToken=await signGmailKeyActionToken(payload,gmailSecret)
    const{error:gmailTokenError}=await db.rpc('issue_gmail_key_action_token',{p_outbox_id:row.id,p_key_request_id:row.entity_id,p_recipient_email:row.recipient_email,p_action:gmailActionType,p_expires_at:new Date(expiresAt*1000).toISOString(),p_raw_token:rawToken})
    if(gmailTokenError)throw new Error(gmailTokenError.message)
    gmailAction={name:gmailActionType==='CANCEL'?'ยกเลิกคำขอ':'ยืนยันคืนกุญแจ',url:`${url}/functions/v1/gmail-key-request-action?token=${encodeURIComponent(rawToken)}`}
   }
   const rendered=renderKeyRequestEmail(row.template_key,{requestCode:item.request_code,roomName:item.room_name,startsAt:item.starts_at,endsAt:item.ends_at,purpose:item.purpose,status:String(row.payload.status??item.status),reason:String(row.payload.reason??item.decision_reason??'')||null,links,gmailAction})
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json','Idempotency-Key':row.idempotency_key},body:JSON.stringify({from:'ITD336 <onboarding@resend.dev>',to:[row.recipient_email],subject:rendered.subject,html:rendered.html})})
   const provider=await response.json().catch(()=>({})) as{id?:string;message?:string}
   if(!response.ok)throw new Error(provider.message??`RESEND_${response.status}`)
   await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:true,p_error:null,p_provider_message_id:provider.id??null});sent++
  }catch(error){failed++;await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:false,p_error:error instanceof Error?error.message:'UNKNOWN_DELIVERY_ERROR',p_provider_message_id:null})}
 }
 return json({claimed:(claimed??[]).length,sent,failed,mode})
})
