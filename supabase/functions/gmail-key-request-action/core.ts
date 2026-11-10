import {verifyGmailKeyActionToken,type GmailKeyActionPayload} from '../_shared/gmail-key-action.ts'
interface Options{secret:string;now?:()=>number;verifyGoogleBearer:(token:string)=>Promise<boolean>;authorizeScope?:(payload:GmailKeyActionPayload)=>Promise<boolean>;consume:(rawToken:string,payload:GmailKeyActionPayload)=>Promise<{requestCode:string;status:string}>;notify:()=>Promise<void>;log?:(event:string)=>void}
const json=(body:unknown,status:number,extra:HeadersInit={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...extra}})
export function createGmailKeyRequestActionHandler({secret,now=()=>Math.floor(Date.now()/1000),verifyGoogleBearer,authorizeScope=async()=>false,consume,notify,log}:Options){
 return async(req:Request)=>{
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405,{allow:'POST'})
  const authorization=req.headers.get('authorization')??'';if(!authorization.startsWith('Bearer '))return json({ok:false,error:'GOOGLE_BEARER_REQUIRED'},401)
  if(!await verifyGoogleBearer(authorization.slice(7)))return json({ok:false,error:'INVALID_GOOGLE_BEARER'},401)
  const rawToken=new URL(req.url).searchParams.get('token')??'';const payload=await verifyGmailKeyActionToken(rawToken,secret,now())
  if(!payload)return json({ok:false,error:'INVALID_OR_EXPIRED_ACTION_TOKEN'},401)
  if(!await authorizeScope(payload))return json({ok:false,error:'SELF_TEST_SCOPE_DENIED'},403)
  try{
   const result=await consume(rawToken,payload)
   try{await notify()}catch{log?.('gmail_key_action_notification_deferred')}
   log?.('gmail_key_action_success')
   return json({ok:true,requestCode:result.requestCode,status:result.status},200)
  }catch(error){
   const message=error instanceof Error?error.message:'ACTION_FAILED'
   if(message.includes('ACTION_TOKEN_ALREADY_USED'))return json({ok:false,error:'ACTION_TOKEN_ALREADY_USED'},409)
   if(message.includes('ACTION_TOKEN_EXPIRED'))return json({ok:false,error:'ACTION_TOKEN_EXPIRED'},401)
   if(message.includes('KEY_REQUEST_NOT_'))return json({ok:false,error:'ACTION_NOT_ALLOWED'},409)
   return json({ok:false,error:'ACTION_FAILED'},400)
  }
 }
}
