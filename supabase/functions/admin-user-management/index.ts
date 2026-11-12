import {createClient} from 'npm:@supabase/supabase-js@2.57.4'

const cors={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}})
type Body={action?:'INVITE'|'SET_STATUS';email?:string;fullName?:string;roleCodes?:string[];userId?:string;status?:'ACTIVE'|'SUSPENDED'|'INACTIVE'}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors})
 if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
 const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const authHeader=req.headers.get('authorization')??''
 if(!url||!serviceKey)return json({error:'FUNCTION_CONFIGURATION_MISSING'},503)
 const db=createClient(url,serviceKey,{auth:{persistSession:false}})
 const token=authHeader.replace(/^Bearer\s+/i,'');const{data:{user:actor}}=await db.auth.getUser(token)
 if(!actor)return json({error:'AUTHENTICATION_REQUIRED'},401)
 const{data:adminRole}=await db.from('user_roles').select('role_id,roles!inner(code),profiles!inner(account_status)').eq('user_id',actor.id).eq('roles.code','ADMIN').eq('profiles.account_status','ACTIVE').maybeSingle()
 if(!adminRole)return json({error:'FORBIDDEN'},403)
 const body=await req.json().catch(()=>({})) as Body

 if(body.action==='INVITE'){
  const email=body.email?.trim().toLowerCase()??'';const fullName=body.fullName?.trim()??'';const roleCodes=[...new Set((body.roleCodes??[]).map((code)=>code.trim().toUpperCase()).filter(Boolean))]
  if(!/^\S+@\S+\.\S+$/.test(email)||!fullName)return json({error:'INVALID_USER_DETAILS'},400)
  const{data:roles,error:roleError}=await db.from('roles').select('id,code').in('code',roleCodes)
  if(roleError||roles?.length!==roleCodes.length)return json({error:'INVALID_ROLE'},400)
  const{data:invited,error:inviteError}=await db.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName}})
  if(inviteError||!invited.user)return json({error:inviteError?.message??'INVITE_FAILED'},400)
  if(roles?.length){const{error}=await db.from('user_roles').insert(roles.map((role)=>({user_id:invited.user.id,role_id:role.id,assigned_by:actor.id})));if(error)return json({error:error.message},500)}
  await db.from('audit_logs').insert({actor_id:actor.id,action:'USER_INVITED',entity_type:'profile',entity_id:invited.user.id,metadata:{email,role_codes:roleCodes}})
  return json({userId:invited.user.id})
 }

 if(body.action==='SET_STATUS'){
  if(!body.userId||!body.status||!['ACTIVE','SUSPENDED','INACTIVE'].includes(body.status))return json({error:'INVALID_STATUS_REQUEST'},400)
  const{data:targetRoles}=await db.from('user_roles').select('roles!inner(code)').eq('user_id',body.userId).eq('roles.code','ADMIN')
  if(body.status!=='ACTIVE'&&targetRoles?.length){const{count}=await db.from('user_roles').select('user_id,roles!inner(code)',{count:'exact',head:true}).eq('roles.code','ADMIN');if((count??0)<=1)return json({error:'LAST_ADMIN_REQUIRED'},409)}
  const{error:authError}=await db.auth.admin.updateUserById(body.userId,{ban_duration:body.status==='ACTIVE'?'none':'876000h'})
  if(authError)return json({error:authError.message},500)
  const{error:profileError}=await db.from('profiles').update({account_status:body.status}).eq('id',body.userId)
  if(profileError){await db.auth.admin.updateUserById(body.userId,{ban_duration:'none'});return json({error:profileError.message},500)}
  await db.from('audit_logs').insert({actor_id:actor.id,action:'USER_ACCOUNT_STATUS_UPDATED',entity_type:'profile',entity_id:body.userId,metadata:{status:body.status}})
  return json({userId:body.userId,status:body.status})
 }
 return json({error:'INVALID_ACTION'},400)
})
