import { createClient } from 'npm:@supabase/supabase-js@2.57.4'

const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers})
const actionError=(message:string)=>message.includes('ACTION_TOKEN_EXPIRED')?['ACTION_TOKEN_EXPIRED','ลิงก์หมดอายุแล้ว']:message.includes('ACTION_TOKEN_ALREADY_USED')?['ACTION_TOKEN_ALREADY_USED','ลิงก์นี้ถูกใช้งานแล้ว']:message.includes('KEY_REQUEST_NOT_CANCELLABLE')?['KEY_REQUEST_NOT_CANCELLABLE','คำขอนี้ถูกยกเลิกแล้วหรือไม่อยู่ในสถานะที่ยกเลิกได้']:message.includes('KEY_REQUEST_NOT_RETURNABLE')?['KEY_REQUEST_NOT_RETURNABLE','คำขอนี้ยังไม่อยู่ในสถานะที่คืนกุญแจได้']:['INVALID_ACTION_TOKEN','ลิงก์ไม่ถูกต้อง']

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED',message:'Method not allowed'},405)
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!serviceKey)return json({ok:false,code:'NOT_CONFIGURED',message:'ระบบไม่พร้อมใช้งาน'},503)
 const body=await req.json().catch(()=>({})) as{action?:string;token?:string};const action=(body.action??'').toUpperCase();const token=body.token??''
 if(!['CANCEL','RETURN'].includes(action)||token.length<32)return json({ok:false,code:'INVALID_ACTION_TOKEN',message:'ลิงก์ไม่ถูกต้อง'},400)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}});const{data,error}=await db.rpc('consume_key_request_action',{p_raw_token:token,p_action:action})
 if(error){const[code,message]=actionError(error.message);return json({ok:false,code,message})}
 const result=data as{request_code?:string;status?:string};return json({ok:true,requestCode:result.request_code??'',status:result.status??''})
})
