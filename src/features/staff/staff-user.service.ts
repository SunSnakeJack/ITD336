import { supabase } from '../../lib/supabase/client'
import type { StaffRoleOption, StaffUserDirectoryItem } from './types/staff-user.types'
import { getStaffUserStatusErrorMessage } from './utils/staff-user-status-error'

interface StaffUserDirectoryRow {user_id:string;first_name:string|null;last_name:string|null;full_name:string;email:string;account_status:StaffUserDirectoryItem['accountStatus'];role_codes:string[]|null;role_names:string[]|null}

export async function getStaffUserDirectory():Promise<StaffUserDirectoryItem[]>{
  const{data,error}=await supabase.rpc('get_admin_user_directory_v2' as never) as unknown as{data:StaffUserDirectoryRow[]|null;error:{message:string}|null}
  if(error){if(error.message.includes('FORBIDDEN'))throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูรายชื่อผู้ใช้งาน');throw new Error(error.message)}
  return(data??[]).map((row)=>({id:row.user_id,firstName:row.first_name??row.full_name,lastName:row.last_name??'',fullName:row.full_name,email:row.email,accountStatus:row.account_status,roleCodes:row.role_codes??[],roleNames:row.role_names??[]}))
}

export async function updateStaffUserProfile(input:{userId:string;firstName:string;lastName:string}){
  const{error}=await supabase.rpc('update_admin_user_profile' as never,{p_user_id:input.userId,p_first_name:input.firstName,p_last_name:input.lastName} as never) as unknown as{error:{message:string}|null}
  if(error)throw new Error(error.message.includes('FORBIDDEN')?'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้':error.message)
}

export async function getStaffRoleOptions():Promise<StaffRoleOption[]>{
  const{data,error}=await supabase.rpc('get_admin_role_options' as never) as unknown as{data:StaffRoleOption[]|null;error:{message:string}|null}
  if(error)throw new Error(error.message.includes('FORBIDDEN')?'บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท':error.message)
  return data??[]
}

export async function setStaffUserRoles(input:{userId:string;roleCodes:string[]}){
  const{data,error}=await supabase.rpc('set_admin_user_roles' as never,{p_user_id:input.userId,p_role_codes:input.roleCodes} as never) as unknown as{data:{user_id:string;role_codes:string[]}|null;error:{message:string}|null}
  if(error){if(error.message.includes('LAST_ADMIN_REQUIRED'))throw new Error('ไม่สามารถนำบทบาทผู้ดูแลระบบออกจากผู้ดูแลคนสุดท้ายได้');if(error.message.includes('FORBIDDEN'))throw new Error('บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท');throw new Error(error.message)}
  return data
}

export async function inviteStaffUser(input:{email:string;fullName:string;roleCodes:string[]}){
  const{data,error}=await supabase.functions.invoke('admin-user-management',{body:{action:'INVITE',...input}})
  if(error)throw new Error(error.message)
  if(data?.error)throw new Error(data.error==='FORBIDDEN'?'บัญชีนี้ไม่มีสิทธิ์เพิ่มสมาชิก':String(data.error))
  return data as{userId:string}
}

export async function setStaffUserStatus(input:{userId:string;status:StaffUserDirectoryItem['accountStatus']}){
  const{data,error}=await supabase.functions.invoke('admin-user-management',{body:{action:'SET_STATUS',...input}})
  if(error)throw new Error(await getStaffUserStatusErrorMessage(error))
  if(data?.error){if(data.error==='LAST_ADMIN_REQUIRED')throw new Error('ไม่สามารถระงับหรือปิดใช้งานผู้ดูแลระบบคนสุดท้ายได้');throw new Error(String(data.error))}
  return data as{userId:string;status:StaffUserDirectoryItem['accountStatus']}
}
