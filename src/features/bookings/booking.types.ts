export type BookingStatus='PENDING'|'APPROVED'|'REJECTED'|'CANCELLED'|'IN_USE'|'COMPLETED'|'NO_SHOW'
export interface Booking { id:string; booking_code:string; requester_id:string; room_id:string; starts_at:string; ends_at:string; purpose:string; notes:string|null; status:BookingStatus; requires_key:boolean; created_at:string; updated_at:string }
export interface CreateBookingInput { roomId:string; startsAt:string; endsAt:string; purpose:string; requiresKey?:boolean; notes?:string|null }
export interface RpcResult { id:string; status:string; booking_code?:string; key_id?:string }
