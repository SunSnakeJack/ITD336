import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const escapeHtml=(value:string)=>value.replace(/[&<>'"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]??char))
const page=(title:string,body:string,status=200)=>new Response(`<!doctype html><html lang="th"><meta name="viewport" content="width=device-width"><body style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:20px"><h1>${escapeHtml(title)}</h1>${body}</body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'}})

Deno.serve(async(req)=>{
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!serviceKey)return page('ระบบไม่พร้อมใช้งาน','<p>กรุณาลองใหม่ภายหลัง</p>',503)
 const parsed=new URL(req.url);let action=(parsed.searchParams.get('action')??'').toUpperCase();let token=parsed.searchParams.get('token')??''
 if(req.method==='POST'){const form=await req.formData();action=String(form.get('action')??'').toUpperCase();token=String(form.get('token')??'')}
 if(!['TRACK','CANCEL','RETURN'].includes(action)||token.length<32)return page('ลิงก์ไม่ถูกต้อง','<p>กรุณาตรวจสอบลิงก์จากอีเมลอีกครั้ง</p>',400)
 if(req.method==='GET'&&action!=='TRACK')return page(action==='CANCEL'?'ยืนยันการยกเลิกคำขอ':'ยืนยันการคืนกุญแจ',`<p>การดำเนินการนี้ใช้ได้ครั้งเดียว</p><form method="post"><input type="hidden" name="action" value="${action}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button style="padding:12px 20px">ยืนยัน</button></form>`)
 if(req.method!=='GET'&&req.method!=='POST')return page('Method not allowed','',405)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});const{data,error}=await db.rpc('consume_key_request_action',{p_raw_token:token,p_action:action})
 if(error)return page('ไม่สามารถดำเนินการได้',`<p>${escapeHtml(error.message.includes('EXPIRED')?'ลิงก์หมดอายุแล้ว':'ลิงก์ไม่ถูกต้องหรือถูกใช้งานแล้ว')}</p>`,400)
 const result=data as{request_code?:string;status?:string};return page('ดำเนินการสำเร็จ',`<p>คำขอ ${escapeHtml(result.request_code??'')} อยู่ในสถานะ ${escapeHtml(result.status??'')}</p>`)
})
