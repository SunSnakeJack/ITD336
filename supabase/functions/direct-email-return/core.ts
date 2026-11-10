import {verifyGmailKeyActionToken,type GmailKeyActionPayload} from '../_shared/gmail-key-action.ts'

interface Options{secret:string;now?:()=>number;scopeExpiresAt:number;correlationId?:()=>string;authorizeScope:(payload:GmailKeyActionPayload)=>Promise<boolean>;consume:(rawToken:string,payload:GmailKeyActionPayload)=>Promise<{requestCode:string;status:string}>}
const page=(title:string,message:string,status:number,id:string)=>new Response(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="font-family:system-ui;max-width:36rem;margin:4rem auto;padding:1rem"><h1>${title}</h1><p>${message}</p></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','content-disposition':'inline','content-language':'th','x-content-type-options':'nosniff','x-correlation-id':id,'cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"}})

export function createDirectEmailReturnHandler({secret,now=()=>Math.floor(Date.now()/1000),scopeExpiresAt,correlationId=()=>crypto.randomUUID(),authorizeScope,consume}:Options){
 return async(req:Request)=>{const id=correlationId()
  if(req.method!=='GET')return page('ไม่รองรับคำขอนี้','กรุณาเปิดลิงก์จากอีเมล',405,id)
  const rawToken=new URL(req.url).searchParams.get('token')??'';const payload=await verifyGmailKeyActionToken(rawToken,secret,now())
  if(!payload||payload.action!=='RETURN')return page('ลิงก์ไม่ถูกต้อง','ลิงก์หมดอายุหรือข้อมูลไม่ถูกต้อง',401,id)
  const current=now();if(current>=scopeExpiresAt||payload.exp>scopeExpiresAt)return page('ลิงก์หมดอายุ','ขอบเขตการทดสอบหมดอายุแล้ว',401,id)
  if(!await authorizeScope(payload))return page('ไม่อนุญาต','คำขอนี้อยู่นอกขอบเขตการทดสอบ',403,id)
  try{const result=await consume(rawToken,payload);return page('คืนกุญแจสำเร็จ',`คำขอ ${result.requestCode} ยืนยันคืนกุญแจแล้ว`,200,id)}catch(error){const message=error instanceof Error?error.message:'ACTION_FAILED'
   if(message.includes('ACTION_TOKEN_ALREADY_USED'))return page('ลิงก์ถูกใช้แล้ว','คำขอนี้ถูกดำเนินการไปแล้ว',409,id)
   if(message.includes('ACTION_TOKEN_EXPIRED'))return page('ลิงก์หมดอายุ','กรุณาติดต่อผู้ดูแลระบบ',401,id)
   if(message.includes('KEY_REQUEST_NOT_RETURNABLE'))return page('คืนกุญแจไม่ได้','คำขอยังไม่อยู่ในสถานะที่คืนกุญแจได้',409,id)
   return page('เกิดข้อผิดพลาด','ไม่สามารถยืนยันคืนกุญแจได้',400,id)
  }
 }
}
