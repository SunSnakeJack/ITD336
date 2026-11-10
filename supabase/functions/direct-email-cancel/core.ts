import {verifyGmailKeyActionToken,type GmailKeyActionPayload} from '../_shared/gmail-key-action.ts'

type Stage='request'|'method'|'token_validation'|'ttl_validation'|'scope'|'rpc'|'business_rule'|'notification'|'complete'
export interface DirectCancelDiagnostic{correlationId:string;method:string;stage:Stage;resultCode:string;reason?:string;requestId?:string}
interface Options{secret:string;now?:()=>number;scopeExpiresAt:number;correlationId?:()=>string;authorizeScope:(payload:GmailKeyActionPayload)=>Promise<boolean>;consume:(rawToken:string,payload:GmailKeyActionPayload)=>Promise<{requestCode:string;status:string}>;notify:(correlationId:string,requestId:string)=>Promise<void>;log?:(event:DirectCancelDiagnostic)=>void}
const page=(title:string,message:string,status:number,correlationId:string)=>new Response(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:1rem"><h1>${title}</h1><p>${message}</p></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','content-disposition':'inline','content-language':'th','x-content-type-options':'nosniff','x-correlation-id':correlationId,'cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"}})

export function createDirectEmailCancelHandler({secret,now=()=>Math.floor(Date.now()/1000),scopeExpiresAt,correlationId=()=>crypto.randomUUID(),authorizeScope,consume,notify,log}:Options){
 return async(req:Request)=>{
  const id=correlationId(),method=req.method
  const diagnostic=(stage:Stage,resultCode:string,reason?:string,requestId?:string)=>log?.({correlationId:id,method,stage,resultCode,...(reason?{reason}:{}),...(requestId?{requestId}:{})})
  diagnostic('request','received')
  if(method!=='GET'){diagnostic('method','rejected','method_not_allowed');return page('ไม่รองรับคำขอนี้','กรุณาเปิดลิงก์จากอีเมล',405,id)}
  const rawToken=new URL(req.url).searchParams.get('token')??''
  const payload=await verifyGmailKeyActionToken(rawToken,secret,now())
  if(!payload||payload.action!=='CANCEL'){diagnostic('token_validation','rejected','invalid_or_expired_token');return page('ลิงก์ไม่ถูกต้อง','ลิงก์หมดอายุหรือข้อมูลไม่ถูกต้อง',401,id)}
  diagnostic('token_validation','valid',undefined,payload.requestId)
  const currentTime=now()
  if(currentTime>=scopeExpiresAt||payload.exp>scopeExpiresAt){diagnostic('ttl_validation','rejected',currentTime>=scopeExpiresAt?'ttl_expired':'token_exceeds_scope_ttl',payload.requestId);return page('ลิงก์หมดอายุ','ขอบเขตการทดสอบหมดอายุแล้ว',401,id)}
  diagnostic('ttl_validation','valid',undefined,payload.requestId)
  if(!await authorizeScope(payload)){diagnostic('scope','rejected','request_out_of_scope',payload.requestId);return page('ไม่อนุญาต','คำขอนี้อยู่นอกขอบเขตการทดสอบ',403,id)}
  diagnostic('scope','valid',undefined,payload.requestId)
  try{
   diagnostic('rpc','started',undefined,payload.requestId)
   const result=await consume(rawToken,payload)
   diagnostic('rpc','success',undefined,payload.requestId)
   try{await notify(id,payload.requestId);diagnostic('notification','success',undefined,payload.requestId)}catch{diagnostic('notification','deferred','worker_invocation_failed',payload.requestId)}
   diagnostic('complete','success',undefined,payload.requestId)
   return page('ยกเลิกคำขอสำเร็จ',`คำขอ ${result.requestCode} ถูกยกเลิกแล้ว`,200,id)
  }catch(error){
   const message=error instanceof Error?error.message:'ACTION_FAILED'
   if(message.includes('ACTION_TOKEN_ALREADY_USED')){diagnostic('rpc','rejected','token_already_used',payload.requestId);return page('ลิงก์ถูกใช้แล้ว','คำขอนี้ถูกดำเนินการไปแล้ว',409,id)}
   if(message.includes('ACTION_TOKEN_EXPIRED')){diagnostic('rpc','rejected','token_expired',payload.requestId);return page('ลิงก์หมดอายุ','กรุณาติดต่อผู้ดูแลระบบ',401,id)}
   if(message.includes('KEY_REQUEST_NOT_CANCELLABLE')){diagnostic('business_rule','rejected','request_not_cancellable',payload.requestId);return page('ยกเลิกไม่ได้','คำขอไม่อยู่ในสถานะที่ยกเลิกได้',409,id)}
   diagnostic('rpc','failed','action_failed',payload.requestId)
   return page('เกิดข้อผิดพลาด','ไม่สามารถยกเลิกคำขอได้',400,id)
  }
 }
}
