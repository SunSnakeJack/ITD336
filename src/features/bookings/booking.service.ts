import { supabase, unwrap } from '../../lib/supabase/client'
import type { Booking, CreateBookingInput, RpcResult } from './booking.types'
export const getMyBookings = () => unwrap<Booking[]>(supabase.from('bookings').select('*').order('starts_at',{ascending:false}))
export const getBookingById = (id:string) => unwrap<Booking>(supabase.from('bookings').select('*').eq('id',id).single())
export const getPendingBookings = () => unwrap<Booking[]>(supabase.from('bookings').select('*').eq('status','PENDING').order('created_at'))
export const createBooking = (input:CreateBookingInput) => unwrap<RpcResult>(supabase.rpc('create_booking',{p_room_id:input.roomId,p_starts_at:input.startsAt,p_ends_at:input.endsAt,p_purpose:input.purpose,p_requires_key:input.requiresKey??false,p_notes:input.notes??undefined}))
export const approveBooking = (id:string,reason?:string) => unwrap<RpcResult>(supabase.rpc('approve_booking',{p_booking_id:id,p_reason:reason}))
export const rejectBooking = (id:string,reason:string) => unwrap<RpcResult>(supabase.rpc('reject_booking',{p_booking_id:id,p_reason:reason}))
export const cancelBooking = (id:string,reason:string) => unwrap<RpcResult>(supabase.rpc('cancel_booking',{p_booking_id:id,p_reason:reason}))
