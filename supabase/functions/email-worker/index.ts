import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { renderKeyRequestEmail } from '../_shared/email-templates.ts'
import {emailDeliveryPolicy,matchesTestRecipient} from '../_shared/email-delivery-policy.ts'

type OutboxRow={id:string;entity_type:string;entity_id:string;recipient_email:string;template_key:string;payload:Record<string,unknown>;idempotency_key:string}
type RequestRow={request_code:string;status:string;starts_at:string;ends_at:string;purpose:string;decision_reason:string|null;room_name:string}
const ownerActionTemplates = new Set([
 'key-request-submitted','key-request-approved','key-request-starting-soon',
 'key-request-ending-soon','key-request-ended','key-request-overdue','key-request-updated',
])
const corsHeaders={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}})
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders})
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
 const mode=Deno.env.get('EMAIL_DELIVERY_MODE')??'test';const allowed=Deno.env.get('RESEND_ALLOWED_RECIPIENT')?.trim().toLowerCase();const cronSecret=Deno.env.get('CRON_SECRET')
 if(mode==='test'&&allowed!=='sufeeyan.tale@northbkk.ac.th')return json({error:'APPROVED_TEST_RECIPIENT_REQUIRED'},503)
 let delivery:ReturnType<typeof emailDeliveryPolicy>
 try{delivery=emailDeliveryPolicy(mode,allowed,Deno.env.get('RESEND_FROM'))}catch(error){return json({error:error instanceof Error?error.message:'DELIVERY_CONFIGURATION_INVALID'},503)}
 const sender = 'IT KeySpace <noreply@itd336.app>'
 if(delivery.from!==sender&&delivery.from!=='ITD336 <noreply@itd336.app>')return json({error:'ITD336_SENDER_REQUIRED'},503)
 const cronAuthorized=Boolean(cronSecret)&&req.headers.get('authorization')===`Bearer ${cronSecret}`
 const cutoff=Deno.env.get('EMAIL_PRODUCTION_START_AT')
 if(mode==='production'&&(!cronAuthorized||!cutoff||!Number.isFinite(Date.parse(cutoff))))return json({error:'PRODUCTION_DISPATCH_NOT_READY'},403)
 let site: URL | undefined
 const siteUrl = Deno.env.get('PUBLIC_SITE_URL')
 if (siteUrl) {
  try { site = new URL(siteUrl) } catch { return json({error:'PUBLIC_SITE_URL_INVALID'},503) }
  if (site.protocol !== 'https:' || site.username || site.password) return json({error:'PUBLIC_SITE_URL_INVALID'},503)
 }
 const body=await req.json().catch(()=>({})) as{entityId?:string;dispatchToken?:string;templateKey?:string};const entityId=body.entityId?.trim()??'';const dispatchToken=body.dispatchToken??'';const templateKey=body.templateKey??''
 if(!cronAuthorized&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)||dispatchToken.length<32))return json({error:'INVALID_ENTITY_DISPATCH'},400)
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const resendKey=Deno.env.get('ITD336_RESEND_API_KEY')
 if(!url||!serviceKey||!resendKey)return json({error:'WORKER_CONFIGURATION_MISSING'},503)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});const workerId=`email-worker-${crypto.randomUUID()}`
 const scopedRetry=cronAuthorized&&uuid.test(entityId)&&(templateKey==='key-request-cancelled'||templateKey==='key-request-returned')
 const testEntityId=Deno.env.get('EMAIL_TEST_ENTITY_ID')?.trim()
 if(testEntityId&&(!uuid.test(testEntityId)||mode!=='test'||cronAuthorized||entityId!==testEntityId)){
  return json({error:'OUTSIDE_EMAIL_TEST_SCOPE'},403)
 }
 if(mode==='test'&&cronAuthorized&&!scopedRetry)return json({error:'BATCH_DISPATCH_DISABLED'},403)
 const claim=mode==='production'
  ?db.rpc('claim_new_production_emails',{p_worker_id:workerId,p_start_at:cutoff})
  :scopedRetry
  ?db.rpc('claim_terminal_notification_outbox_retry',{p_worker_id:workerId,p_recipient:allowed,p_entity_id:entityId,p_template_key:templateKey})
  :db.rpc('claim_notification_outbox_entity_test',{p_worker_id:workerId,p_recipient:allowed,p_entity_id:entityId,p_dispatch_token:dispatchToken,p_limit:testEntityId?1:10})
 const{data:claimed,error:claimError}=await claim
 if(claimError)return json({error:'CLAIM_FAILED',code:claimError.code},500)
 let sent=0,failed=0
 for(const row of(claimed??[]) as OutboxRow[]){
  try{
   if(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(row.recipient_email))throw new Error('INVALID_OUTBOX_RECIPIENT')
   if(delivery.recipient!==null&&!matchesTestRecipient(row.recipient_email,delivery.recipient))throw new Error('OUTSIDE_EMAIL_TEST_RECIPIENT')
   if(testEntityId&&(row.entity_id!==testEntityId||row.template_key!=='key-request-submitted'))throw new Error('OUTSIDE_EMAIL_TEST_SCOPE')
   const booking=row.entity_type==='booking'
   const{data:context,error:requestError}=booking?await db.rpc('get_booking_email_context',{p_booking_id:row.entity_id}):await db.rpc('get_key_request_email_context',{p_key_request_id:row.entity_id})
   const item=(context?.[0]??null) as RequestRow|null
   if(requestError||!item)throw new Error(requestError?.message??'KEY_REQUEST_NOT_FOUND')
   if(row.template_key==='key-request-expired'&&(item.status!=='PENDING_APPROVAL'||Date.parse(item.ends_at)>Date.now()))throw new Error('STALE_TIMED_NOTIFICATION')
   if(['key-request-starting-soon','key-request-ending-soon','key-request-ended','key-request-overdue'].includes(row.template_key)&&!['APPROVED','IN_USE'].includes(item.status))throw new Error('STALE_TIMED_NOTIFICATION')
   if(row.template_key.endsWith('-starting-soon')&&Date.parse(item.starts_at)<=Date.now())throw new Error('STALE_TIMED_NOTIFICATION')
   if(row.template_key==='booking-starting-soon'&&item.status!=='APPROVED')throw new Error('STALE_TIMED_NOTIFICATION')
   const links = { track: '', cancel: '', returnKey: '', edit: '' }
   if (mode === 'production' && site && (booking || ownerActionTemplates.has(row.template_key))) {
    const details = new URL('/account/requests', site)
    details.searchParams.set('item', row.entity_id)
    if (!booking) details.searchParams.set('tab', 'keys')
    links.track = details.href
    const future = Date.parse(item.starts_at) > Date.now()
    if (future && ['PENDING','PENDING_APPROVAL','APPROVED'].includes(item.status)) {
     details.searchParams.set('edit', row.entity_id)
     links.edit = details.href
    }
    const cancellable = ['PENDING_APPROVAL','APPROVED','IN_USE'].includes(item.status) && Date.parse(item.ends_at) > Date.now()
    const returnable = ['APPROVED','IN_USE'].includes(item.status)
    if (!booking && (cancellable || returnable)) {
     const {data: tokens, error: tokenError} = await db.rpc('issue_key_request_action_bundle', {
      p_key_request_id: row.entity_id,
      p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
     })
     if (tokenError || !tokens) throw new Error('ACTION_LINK_ISSUE_FAILED')
     const actionUrl = (action: string, token: string) => {
      const link = new URL('/key-request-action', site)
      link.hash = new URLSearchParams({action, token}).toString()
      return link.href
     }
     if (cancellable) links.cancel = actionUrl('CANCEL', tokens.cancel_token)
     if (returnable) links.returnKey = actionUrl('RETURN', tokens.return_token)
    }
   }
   const details = (field: string, fallback: string) => typeof row.payload[field] === 'string' ? String(row.payload[field]) : fallback
   const rendered=renderKeyRequestEmail(row.template_key,{requestCode:item.request_code,roomName:item.room_name,startsAt:details('starts_at',item.starts_at),endsAt:details('ends_at',item.ends_at),purpose:details('purpose',item.purpose),status:details('status',item.status),reason:String(row.payload.reason??item.decision_reason??'')||null,links,showWebActions:mode==='production',logoUrl:site?new URL('/images/it-keyspace-brand.png',site).href:undefined})
   const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10_000),headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json','Idempotency-Key':row.idempotency_key},body:JSON.stringify({from:sender,to:[row.recipient_email],subject:rendered.subject,html:rendered.html})})
   const provider=await response.json().catch(()=>({})) as{id?:string;message?:string}
   if(!response.ok||!provider.id)throw new Error(`RESEND_${response.status}`)
   const {error: completionError}=await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:true,p_error:null,p_provider_message_id:provider.id})
   if(completionError){console.error('EMAIL_ACCEPTED_OUTBOX_UPDATE_FAILED',row.id);failed++;continue}
   sent++
  }catch(error){
   failed++
   const {error: completionError}=await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:false,p_error:error instanceof Error?error.message:'UNKNOWN_DELIVERY_ERROR',p_provider_message_id:null})
   if(completionError)console.error('EMAIL_FAILURE_OUTBOX_UPDATE_FAILED',row.id)
  }
 }
 return json({claimed:(claimed??[]).length,sent,failed,mode})
})
