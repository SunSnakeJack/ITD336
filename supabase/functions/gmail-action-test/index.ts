import {createClient} from 'npm:@supabase/supabase-js@2.57.4'
import {createGmailActionHandler,type ReplayStore} from './core.ts'

const url=Deno.env.get('SUPABASE_URL')??''
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??''
const db=url&&serviceKey?createClient(url,serviceKey,{auth:{persistSession:false}}):null
const replayStore:ReplayStore={consume:async(jti,expiresAt)=>{
  if(!db)return false
  const{data,error}=await db.rpc('consume_gmail_action_test_nonce',{p_jti:jti,p_expires_at:new Date(expiresAt*1000).toISOString()})
  return !error&&data===true
}}

Deno.serve(async(req)=>{
  const secret=Deno.env.get('GMAIL_ACTION_TEST_SECRET')??''
  if(secret.length<32||!db)return new Response(JSON.stringify({ok:false,error:'NOT_CONFIGURED'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})
  const handler=createGmailActionHandler({secret,replayStore,log:(event)=>console.info(event)})
  return handler(req)
})
