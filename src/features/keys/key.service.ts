import { supabase, unwrap } from '../../lib/supabase/client'
import type { RpcResult } from '../bookings/booking.types'
import type { AdminKeyLoan, AvailableRoomKey, CreateKeyRequestInput, KeyCabinetRoom, KeyLoan, KeyLoanDetail, KeyLoanStatus, KeyRequestResult, KeyUsageSource } from './key.types'

export async function createKeyRequest(input: CreateKeyRequestInput): Promise<KeyRequestResult> {
  const { data, error } = await supabase.rpc('create_key_request' as never, {
    p_room_id: input.roomId,
    p_requester_name: input.requesterName.trim(),
    p_requester_email: input.requesterEmail.trim().toLowerCase(),
    p_purpose_type: input.purposeType,
    p_purpose: input.purpose.trim(),
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_course_code: input.courseCode?.trim() || null,
    p_course_name: input.courseName?.trim() || null,
    p_lecturer_name: input.lecturerName?.trim() || null,
    p_lecturer_email: input.lecturerEmail?.trim().toLowerCase() || null,
  } as never) as unknown as { data: KeyRequestResult | null; error: { message: string } | null }
  if (!error && data) return data
  const message = error?.message ?? 'KEY_REQUEST_FAILED'
  if (message.includes('KEY_REQUEST_TIME_CONFLICT') || message.includes('LEGACY_KEY_REQUEST_TIME_CONFLICT')) throw new Error('ช่วงเวลานี้มีคำขอเบิกกุญแจแล้ว')
  if (message.includes('AUTHENTICATION_REQUIRED')) throw new Error('ห้องนี้ต้องเข้าสู่ระบบมหาวิทยาลัยก่อนส่งคำขอ')
  if (message.includes('UNIVERSITY_EMAIL_REQUIRED')) throw new Error('กรุณาใช้อีเมลมหาวิทยาลัย @northbkk.ac.th')
  if (message.includes('OUTSIDE_SERVICE_HOURS')) throw new Error('กรุณาเลือกเวลาระหว่าง 08:00–18:00 น.')
  if (message.includes('SATURDAY_NOT_AVAILABLE')) throw new Error('ไม่สามารถทำรายการสำหรับวันเสาร์ได้')
  throw new Error(message)
}
export const getMyKeyLoans=()=>unwrap<KeyLoan[]>(supabase.from('key_loans').select('*').order('requested_at',{ascending:false}))
export async function getActiveKeyLoans(): Promise<AdminKeyLoan[]> {
  const rows=await unwrap<Array<KeyLoan&{room_code:string;room_name:string;key_code:string|null;returned_late:boolean|null;borrower_full_name:string|null;borrower_university_id:string|null;borrower_email:string|null}>>(supabase.from('admin_key_activity_v' as never).select('*').order('requested_at',{ascending:false}) as never)
  return rows.map((row)=>({...row,roomCode:row.room_code,roomName:row.room_name,keyCode:row.key_code,returnedLate:Boolean(row.returned_late),borrowerName:row.borrower_full_name,borrowerUniversityId:row.borrower_university_id,borrowerEmail:row.borrower_email}))
}
export const requestKey=(bookingId:string)=>unwrap<RpcResult>(supabase.rpc('request_key',{p_booking_id:bookingId}))
export const approveKeyRequest=(loanId:string,notes?:string)=>unwrap<RpcResult>(supabase.rpc('approve_key_request',{p_key_loan_id:loanId,p_notes:notes}))
export const checkoutKey=(loanId:string,keyId:string,expectedReturnAt:string)=>unwrap<RpcResult>(supabase.rpc('checkout_key',{p_key_loan_id:loanId,p_key_id:keyId,p_expected_return_at:expectedReturnAt}))
export const returnKey=(loanId:string,condition:'NORMAL'|'DAMAGED'|'LOST'='NORMAL',notes?:string)=>unwrap<RpcResult>(supabase.rpc('return_key',{p_key_loan_id:loanId,p_condition:condition,p_notes:notes}))
export async function getMyKeyLoanDetails(): Promise<KeyLoanDetail[]> {
  const rows=await unwrap<Array<{id:string|null;room_id:string|null;room_code:string|null;key_code:string|null;usage_source:KeyUsageSource|null;status:KeyLoanStatus|null;checked_out_at:string|null;expected_return_at:string|null;available_from:string|null;user_reported_return_at:string|null;returned_at:string|null;overdue:boolean|null}>>(supabase.from('key_loan_report_v').select('*').order('expected_return_at',{ascending:false}))
  return rows.filter((row)=>row.id&&row.room_id&&row.status&&row.usage_source).map((row)=>({id:row.id as string,roomId:row.room_id as string,roomCode:row.room_code??'—',keyCode:row.key_code,usageSource:row.usage_source as KeyUsageSource,status:row.status as KeyLoanStatus,checkedOutAt:row.checked_out_at,expectedReturnAt:row.expected_return_at,availableFrom:row.available_from,reportedReturnAt:row.user_reported_return_at,returnedAt:row.returned_at,overdue:Boolean(row.overdue)}))
}
export const confirmKeyReturn=(loanId:string,notes?:string)=>unwrap<RpcResult>(supabase.rpc('confirm_key_return',{p_key_loan_id:loanId,p_notes:notes,p_reported_return_at:new Date().toISOString()}))
export const reportKeyDamage=(loanId:string,description:string)=>unwrap<RpcResult>(supabase.rpc('report_key_damage' as never,{p_key_loan_id:loanId,p_description:description} as never))
export const reportKeyIssue=(loanId:string,condition:'LOST'|'DAMAGED',description:string)=>unwrap<RpcResult>(supabase.rpc('report_key_issue' as never,{p_key_loan_id:loanId,p_condition:condition,p_description:description} as never))
export const reportKeyStatus=(loanId:string,action:'CHECKED_OUT'|'RETURNED'|'LOST'|'DAMAGED',description?:string)=>unwrap<RpcResult>(supabase.rpc('report_key_status' as never,{p_key_loan_id:loanId,p_action:action,p_description:description??null} as never))
export const requestClassKey=(input:{roomId:string;classScheduleId:string;startsAt:string;endsAt:string;notes:string})=>unwrap<RpcResult>(supabase.rpc('request_class_key' as never,{p_room_id:input.roomId,p_class_schedule_id:input.classScheduleId,p_starts_at:input.startsAt,p_ends_at:input.endsAt,p_notes:input.notes} as never))
export const requestBookingKey=(bookingId:string,notes:string)=>unwrap<RpcResult>(supabase.rpc('request_booking_key' as never,{p_booking_id:bookingId,p_notes:notes} as never))
export async function getAvailableRoomKeys():Promise<AvailableRoomKey[]>{
  const rows=await unwrap<Array<{id:string;room_id:string;key_code:string}>>(supabase.from('room_keys').select('id,room_id,key_code').eq('status','AVAILABLE').eq('active',true).order('key_code'))
  return rows.map((row)=>({id:row.id,roomId:row.room_id,keyCode:row.key_code}))
}
export async function getKeyCabinetRooms():Promise<KeyCabinetRoom[]>{const {data,error}=await supabase.rpc('get_admin_key_cabinet' as never) as unknown as {data:Array<{room_id:string;room_code:string;room_name:string;room_active:boolean;key_status:KeyCabinetRoom['keyStatus'];available_keys:number;held_keys:number}>|null;error:{message:string}|null};if(error)throw new Error(error.message);return (data??[]).map((row)=>({roomId:row.room_id,roomCode:row.room_code,roomName:row.room_name,roomActive:row.room_active,keyStatus:row.key_status,availableKeys:Number(row.available_keys),heldKeys:Number(row.held_keys)}))}
