import {createClient} from 'npm:@supabase/supabase-js@2.57.4'
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@6.2.10'
import {createGmailKeyRequestActionHandler} from './core.ts'
import {createGmailSelfTestScope} from '../_shared/gmail-self-test-guard.ts'

const googleJwks=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

Deno.serve(async(req)=>{
 if(Deno.env.get('GMAIL_KEY_ACTION_ENABLED')!=='true')return new Response(JSON.stringify({ok:false,error:'FEATURE_DISABLED'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})
 const url=Deno.env.get('SUPABASE_URL')??''
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''
 const secret=Deno.env.get('GMAIL_KEY_ACTION_SECRET')??''
 const audience=Deno.env.get('GMAIL_ACTION_AUDIENCE')??''
 const cronSecret=Deno.env.get('CRON_SECRET')??''
 if(!url||!serviceKey||secret.length<32||!audience||!cronSecret)return new Response(JSON.stringify({ok:false,error:'NOT_CONFIGURED'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})
 const gmailScope=await createGmailSelfTestScope({deliveryMode:Deno.env.get('EMAIL_DELIVERY_MODE'),enabled:Deno.env.get('GMAIL_KEY_ACTION_ENABLED'),allowedRecipient:Deno.env.get('RESEND_ALLOWED_RECIPIENT'),requestIds:Deno.env.get('GMAIL_KEY_ACTION_TEST_REQUEST_IDS'),expiresAt:Deno.env.get('GMAIL_KEY_ACTION_TEST_EXPIRES_AT'),now:Math.floor(Date.now()/1000)})
 if(!gmailScope)return new Response(JSON.stringify({ok:false,error:'GMAIL_SELF_TEST_SCOPE_INVALID'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})
 const db=createClient(url,serviceKey,{auth:{persistSession:false}})
 const handler=createGmailKeyRequestActionHandler({
  secret,
  verifyGoogleBearer:async(token)=>{
   try{
    const{payload}=await jwtVerify(token,googleJwks,{issuer:['https://accounts.google.com','accounts.google.com'],audience})
    return payload.email==='gmail@system.gserviceaccount.com'&&payload.email_verified===true&&typeof payload.iat==='number'&&typeof payload.exp==='number'
   }catch{return false}
  },
  authorizeScope:async(payload)=>gmailScope.allows(payload.requestId,payload.recipientDigest,Math.floor(Date.now()/1000)),
  consume:async(rawToken,payload)=>{
   const{data,error}=await db.rpc('consume_gmail_key_action',{p_raw_token:rawToken,p_action:payload.action,p_key_request_id:payload.requestId,p_outbox_id:payload.jti,p_recipient_email_digest:payload.recipientDigest})
   if(error)throw new Error(error.message)
   const result=(Array.isArray(data)?data[0]:data) as{request_code?:string;status?:string}|null
   return{requestCode:result?.request_code??'',status:result?.status??''}
  },
  notify:async()=>{
   const response=await fetch(`${url}/functions/v1/email-worker`,{method:'POST',headers:{authorization:`Bearer ${cronSecret}`,'content-type':'application/json'},body:'{}'})
   if(!response.ok)throw new Error('EMAIL_WORKER_INVOCATION_FAILED')
  },
  log:(event)=>console.info(event),
 })
 return handler(req)
})
