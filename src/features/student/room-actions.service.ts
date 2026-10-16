import { supabase } from '../../lib/supabase/client'

export interface RoomSlotPermissions { canBook:boolean;canRequestKey:boolean;bookingReason:string|null;keyReason:string|null;classScheduleId:string|null;ownBookingId:string|null }

export async function getRoomSlotPermissions(input:{roomId:string;startsAt:string;endsAt:string}):Promise<RoomSlotPermissions>{
  const result=await supabase.rpc('get_room_slot_permissions' as never,{p_room_id:input.roomId,p_starts_at:input.startsAt,p_ends_at:input.endsAt} as never) as unknown as {data:Array<{can_book:boolean;can_request_key:boolean;booking_reason:string|null;key_reason:string|null;class_schedule_id:string|null;own_booking_id:string|null}>|null;error:{message:string}|null}
  if(result.error)throw new Error(result.error.message)
  const row=result.data?.[0]
  if(!row)throw new Error('ไม่สามารถตรวจสอบสิทธิ์การใช้ห้องได้')
  return {canBook:row.can_book,canRequestKey:row.can_request_key,bookingReason:row.booking_reason,keyReason:row.key_reason,classScheduleId:row.class_schedule_id,ownBookingId:row.own_booking_id}
}
