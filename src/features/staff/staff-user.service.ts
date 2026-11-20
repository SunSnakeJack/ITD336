import { supabase } from '../../lib/supabase/client'
const leadershipNames: Record<string, string> = { DEAN: 'Dean', DEPARTMENT_HEAD: 'Head of Department' }
import type { StaffRegisteredUser, StaffRoleOption, StaffUserDirectoryItem } from './types/staff-user.types'
import { getStaffUserStatusErrorMessage } from './utils/staff-user-status-error'

interface StaffUserDirectoryRow {user_id:string;first_name:string|null;last_name:string|null;full_name:string;email:string;account_status:StaffUserDirectoryItem['accountStatus'];role_codes:string[]|null;role_names:string[]|null;pending_registration:boolean}

export async function getStaffUserDirectory():Promise<StaffUserDirectoryItem[]>{
  const{data,error}=await supabase.rpc('get_admin_user_directory_v3' as never) as unknown as{data:StaffUserDirectoryRow[]|null;error:{message:string}|null}
  if(error){if(error.message.includes('FORBIDDEN'))throw new Error('บัญชีนี้ไม่มีสิทธิ์ดูรายชื่อผู้ใช้งาน');throw new Error(error.message)}
  return (data ?? []).map((row) => {
    const identity = { id: row.user_id, firstName: row.first_name ?? row.full_name, lastName: row.last_name ?? '',
      fullName: row.full_name, email: row.email, roleCodes: row.role_codes ?? [],
      roleNames: (row.role_codes ?? []).map((code, index) =>
        leadershipNames[code] ?? row.role_names?.[index] ?? code) }
    if (row.pending_registration) return { ...identity, accountStatus: null, pendingRegistration: true }
    if (!row.account_status) throw new Error('ไม่สามารถอ่านสถานะบัญชีผู้ใช้งานได้')
    return { ...identity, accountStatus: row.account_status }
  })
}

export async function updateStaffUserProfile(input:{userId:string;firstName:string;lastName:string}){
  const{error}=await supabase.rpc('update_admin_user_profile' as never,{p_user_id:input.userId,p_first_name:input.firstName,p_last_name:input.lastName} as never) as unknown as{error:{message:string}|null}
  if(error)throw new Error(error.message.includes('FORBIDDEN')?'บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้':error.message)
}

export async function getStaffRoleOptions():Promise<StaffRoleOption[]>{
  const{data,error}=await supabase.rpc('get_admin_role_options' as never) as unknown as{data:StaffRoleOption[]|null;error:{message:string}|null}
  if(error)throw new Error(error.message.includes('FORBIDDEN')?'บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท':error.message)
  return (data ?? []).filter(({ code }) => code !== 'PRIORITY_USER')
    .map((role) => ({ ...role, name: leadershipNames[role.code] ?? role.name }))
}

export async function setStaffUserRoles(input:{userId:string;roleCodes:string[]}){
  const{data,error}=await supabase.rpc('set_admin_user_roles' as never,{p_user_id:input.userId,p_role_codes:input.roleCodes} as never) as unknown as{data:{user_id:string;role_codes:string[]}|null;error:{message:string}|null}
  if(error){if(error.message.includes('LAST_ADMIN_REQUIRED'))throw new Error('ไม่สามารถนำบทบาทผู้ดูแลระบบออกจากผู้ดูแลคนสุดท้ายได้');if(error.message.includes('FORBIDDEN'))throw new Error('บัญชีนี้ไม่มีสิทธิ์จัดการบทบาท');throw new Error(error.message)}
  return data
}

export async function addStaffUser(input: { email: string; fullName: string; roleCodes: string[] }) {
  const { error } = await supabase.rpc('add_admin_preassigned_user' as never, {
    p_email: input.email, p_full_name: input.fullName, p_role_codes: input.roleCodes,
  } as never)
  if (!error) return
  const messages: Record<string, string> = {
    FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์เพิ่มผู้ใช้',
    INVALID_USER_DETAILS: 'กรุณากรอกชื่อและอีเมลให้ถูกต้อง',
    INVALID_ROLE: 'มีบทบาทที่ไม่สามารถกำหนดได้',
    EMAIL_ALREADY_REGISTERED: 'อีเมลนี้มีบัญชีในระบบแล้ว',
    EMAIL_ALREADY_PREASSIGNED: 'อีเมลนี้อยู่ในรายชื่อที่กำหนดสิทธิ์ล่วงหน้าแล้ว',
  }
  throw new Error(messages[error.message] ?? 'ไม่สามารถเพิ่มผู้ใช้ได้ กรุณาลองใหม่')
}

export async function setStaffUserStatus(input:{userId:string;status:StaffRegisteredUser['accountStatus']}){
  const{data,error}=await supabase.functions.invoke('admin-user-management',{body:{action:'SET_STATUS',...input}})
  if(error)throw new Error(await getStaffUserStatusErrorMessage(error))
  if(data?.error){if(data.error==='LAST_ADMIN_REQUIRED')throw new Error('ไม่สามารถระงับหรือปิดใช้งานผู้ดูแลระบบคนสุดท้ายได้');throw new Error(String(data.error))}
  return data as{userId:string;status:StaffRegisteredUser['accountStatus']}
}

export async function removeStaffUser(user: StaffUserDirectoryItem) {
  const { error } = await supabase.rpc('remove_admin_directory_user' as never, {
    p_user_id: user.id,
    p_pending_registration: user.pendingRegistration === true,
  } as never)
  if (!error) return
  const messages: Record<string, string> = {
    FORBIDDEN: 'บัญชีนี้ไม่มีสิทธิ์ลบผู้ใช้',
    CANNOT_DELETE_SELF: 'ไม่สามารถลบบัญชีของตนเองได้',
    LAST_ADMIN_REQUIRED: 'ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้',
    USER_NOT_FOUND: 'ไม่พบผู้ใช้หรือรายการสิทธิ์นี้แล้ว',
  }
  throw new Error(messages[error.message] ?? 'ไม่สามารถลบผู้ใช้ได้ กรุณาลองใหม่')
}
