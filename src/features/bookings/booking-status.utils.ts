import type { BookingStatus } from './booking.types'

export function effectiveBookingStatus(status:BookingStatus,endsAt:string,now=Date.now()):BookingStatus{
  return (status==='APPROVED'||status==='IN_USE')&&new Date(endsAt).getTime()<=now?'COMPLETED':status
}

export function canCancelBooking(status:BookingStatus,endsAt:string,now=Date.now()){
  return (status==='PENDING'||status==='APPROVED')&&new Date(endsAt).getTime()>now
}
