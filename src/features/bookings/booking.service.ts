import { supabase, unwrap } from '../../lib/supabase/client'
import type { AdminBooking, Booking, BookingStatus, CreateBookingInput, MyBooking, RpcResult } from './booking.types'
export async function getMyBookings(): Promise<MyBooking[]> {
  await reconcileExpiredBookings()
  const rows = await unwrap<Array<{ id:string|null;booking_code:string|null;room_code:string|null;room_name:string|null;starts_at:string|null;ends_at:string|null;purpose:string|null;requires_key:boolean|null;status:BookingStatus|null }>>(supabase.from('booking_details_v').select('id,booking_code,room_code,room_name,starts_at,ends_at,purpose,requires_key,status').order('starts_at',{ascending:false}))
  return rows.filter((row) => row.id && row.starts_at && row.ends_at && row.status).map((row) => ({ id:row.id as string,bookingCode:row.booking_code??'—',roomCode:row.room_code??'—',roomName:row.room_name??'—',startsAt:row.starts_at as string,endsAt:row.ends_at as string,purpose:row.purpose??'—',requiresKey:Boolean(row.requires_key),status:row.status as BookingStatus }))
}
export const getBookingById = (id:string) => unwrap<Booking>(supabase.from('bookings').select('*').eq('id',id).single())
export const getPendingBookings = () => unwrap<Booking[]>(supabase.from('bookings').select('*').eq('status','PENDING').order('created_at'))
export async function getAdminBookings(): Promise<AdminBooking[]> {
  await reconcileExpiredBookings()
  const rows = await unwrap<Array<{ id:string|null; booking_code:string|null; room_code:string|null; room_name:string|null; room_user_name:string|null; starts_at:string|null; ends_at:string|null; purpose:string|null; requires_key:boolean|null; status:Booking['status']|null; created_at:string|null }>>(supabase.from('booking_details_v').select('id,booking_code,room_code,room_name,room_user_name,starts_at,ends_at,purpose,requires_key,status,created_at').order('created_at',{ascending:false}))
  return rows.filter((row) => row.id && row.starts_at && row.ends_at && row.status).map((row) => ({ id:row.id as string, bookingCode:row.booking_code ?? '—', roomCode:row.room_code ?? '—', roomName:row.room_name ?? '—', userName:row.room_user_name ?? '—', startsAt:row.starts_at as string, endsAt:row.ends_at as string, purpose:row.purpose ?? '—', requiresKey:Boolean(row.requires_key), status:row.status as Booking['status'], createdAt:row.created_at ?? '' }))
}
export async function reconcileExpiredBookings(){const {error}=await supabase.rpc('reconcile_expired_bookings' as never);if(error)throw new Error(error.message)}
export async function createBooking(input: CreateBookingInput) {
  try {
    return await unwrap<RpcResult>(supabase.rpc('create_booking',{p_room_id:input.roomId,p_starts_at:input.startsAt,p_ends_at:input.endsAt,p_purpose:input.purpose,p_requires_key:input.requiresKey??false,p_notes:input.notes??undefined}))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('ROOM_UNAVAILABLE')) throw new Error('ช่วงเวลานี้มีการใช้งานห้องแล้ว')
    if (message.includes('ADVANCE_BOOKING_LIMIT_EXCEEDED')) throw new Error('สามารถจองล่วงหน้าได้ไม่เกิน 3 วัน')
    if (message.includes('OUTSIDE_OPERATING_HOURS')) throw new Error('ช่วงเวลานี้อยู่นอกเวลาที่เปิดให้ใช้งานห้อง')
    if (message.includes('ROOM_BOOKING_DISABLED')) throw new Error('ห้องนี้ปิดรับการจองชั่วคราว')
    if (message.includes('INVALID_TIME_RANGE')) throw new Error('กรุณาเลือกช่วงเวลาในอนาคตให้ถูกต้อง')
    throw error
  }
}
export const approveBooking = (id:string,reason?:string) => unwrap<RpcResult>(supabase.rpc('approve_booking',{p_booking_id:id,p_reason:reason}))
export const rejectBooking = (id:string,reason:string) => unwrap<RpcResult>(supabase.rpc('reject_booking',{p_booking_id:id,p_reason:reason}))
export async function cancelBooking(id:string,reason:string){try{return await unwrap<RpcResult>(supabase.rpc('cancel_booking',{p_booking_id:id,p_reason:reason}))}catch(error){const message=error instanceof Error?error.message:String(error);if(message.includes('BOOKING_ALREADY_ENDED'))throw new Error('รายการจองนี้สิ้นสุดแล้วและไม่สามารถยกเลิกได้');throw error}}
