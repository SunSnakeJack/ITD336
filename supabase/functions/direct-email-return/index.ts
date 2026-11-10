import {createClient} from 'npm:@supabase/supabase-js@2.57.4'
import {createGmailSelfTestScope} from '../_shared/gmail-self-test-guard.ts'
import {createDirectEmailReturnHandler} from './core.ts'

Deno.serve(async(req)=>{const now=Math.floor(Date.now()/1000),url=Deno.env.get('SUPABASE_URL')??'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',secret=Deno.env.get('GMAIL_KEY_ACTION_SECRET')??''
 const scope=await createGmailSelfTestScope({deliveryMode:Deno.env.get('EMAIL_DELIVERY_MODE'),enabled:Deno.env.get('DIRECT_EMAIL_RETURN_ENABLED'),allowedRecipient:Deno.env.get('RESEND_ALLOWED_RECIPIENT'),requestIds:Deno.env.get('DIRECT_EMAIL_RETURN_REQUEST_IDS'),expiresAt:Deno.env.get('DIRECT_EMAIL_RETURN_EXPIRES_AT'),now})
 if(!url||!serviceKey||secret.length<32||!scope)return new Response('Not configured',{status:503})
 const db=createClient(url,serviceKey,{auth:{persistSession:false}})
 return createDirectEmailReturnHandler({secret,scopeExpiresAt:scope.expiresAt,authorizeScope:async payload=>scope.allows(payload.requestId,payload.recipientDigest,Math.floor(Date.now()/1000)),consume:async(rawToken,payload)=>{const{data,error}=await db.rpc('consume_gmail_key_action',{p_raw_token:rawToken,p_action:'RETURN',p_outbox_id:payload.jti,p_key_request_id:payload.requestId,p_recipient_digest:payload.recipientDigest});if(error)throw new Error(error.message);return{requestCode:String(data?.request_code??''),status:String(data?.status??'')}}})(req)
})
