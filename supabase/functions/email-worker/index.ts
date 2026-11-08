import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { renderKeyRequestEmail } from '../_shared/email-templates.ts'

type OutboxRow={id:string;entity_id:string;recipient_email:string;template_key:string;payload:Record<string,unknown>;idempotency_key:string}
type RequestRow={request_code:string;status:string;starts_at:string;ends_at:string;purpose:string;decision_reason:string|null;room_name:string}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})

Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
 const mode=Deno.env.get('EMAIL_DELIVERY_MODE')??'test';const allowed=Deno.env.get('RESEND_ALLOWED_RECIPIENT')?.trim().toLowerCase();const cronSecret=Deno.env.get('CRON_SECRET')
 if(mode!=='test')return json({error:'VERIFIED_DOMAIN_REQUIRED'},503)
 if(!allowed)return json({error:'RESEND_ALLOWED_RECIPIENT_REQUIRED'},503)
 if(!cronSecret||req.headers.get('authorization')!==`Bearer ${cronSecret}`)return json({error:'UNAUTHORIZED'},401)
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const resendKey=Deno.env.get('RESEND_API_KEY')
 if(!url||!serviceKey||!resendKey)return json({error:'WORKER_CONFIGURATION_MISSING'},503)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});const workerId=`email-worker-${crypto.randomUUID()}`
 const{data:claimed,error:claimError}=await db.rpc('claim_notification_outbox_test',{p_worker_id:workerId,p_recipient:allowed,p_limit:20})
 if(claimError)return json({error:'CLAIM_FAILED',detail:claimError.message},500)
 let sent=0,failed=0
 for(const row of(claimed??[]) as OutboxRow[]){
  try{
   const{data:context,error:requestError}=await db.rpc('get_key_request_email_context',{p_key_request_id:row.entity_id})
   const item=(context?.[0]??null) as RequestRow|null
   if(requestError||!item)throw new Error(requestError?.message??'KEY_REQUEST_NOT_FOUND')
   const expiresAt=new Date(new Date(item.ends_at).getTime()+86_400_000).toISOString()
   const{data:bundle,error:tokenError}=await db.rpc('issue_key_request_action_bundle',{p_key_request_id:row.entity_id,p_expires_at:expiresAt})
   if(tokenError||!bundle)throw new Error(tokenError?.message??'TOKEN_ISSUE_FAILED')
   const actionBase=`${url}/functions/v1/key-request-action`;const link=(action:string,token:string)=>`${actionBase}?action=${action}&token=${encodeURIComponent(token)}`
   const links={track:link('TRACK',bundle.track_token),cancel:link('CANCEL',bundle.cancel_token),returnKey:link('RETURN',bundle.return_token)}
   const rendered=renderKeyRequestEmail(row.template_key,{requestCode:item.request_code,roomName:item.room_name,startsAt:item.starts_at,endsAt:item.ends_at,purpose:item.purpose,status:String(row.payload.status??item.status),reason:String(row.payload.reason??item.decision_reason??'')||null,links})
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${resendKey}`,'content-type':'application/json','Idempotency-Key':row.idempotency_key},body:JSON.stringify({from:'ITD336 <onboarding@resend.dev>',to:[row.recipient_email],subject:rendered.subject,html:rendered.html})})
   const provider=await response.json().catch(()=>({})) as{id?:string;message?:string}
   if(!response.ok)throw new Error(provider.message??`RESEND_${response.status}`)
   await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:true,p_error:null,p_provider_message_id:provider.id??null});sent++
  }catch(error){failed++;await db.rpc('complete_notification_outbox',{p_outbox_id:row.id,p_succeeded:false,p_error:error instanceof Error?error.message:'UNKNOWN_DELIVERY_ERROR',p_provider_message_id:null})}
 }
 return json({claimed:(claimed??[]).length,sent,failed,mode})
})
