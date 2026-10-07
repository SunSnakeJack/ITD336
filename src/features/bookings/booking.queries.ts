import { queryOptions } from '@tanstack/react-query'
import { getBookingById, getMyBookings, getPendingBookings } from './booking.service'
export const bookingKeys={mine:['bookings','mine'] as const,detail:(id:string)=>['bookings','detail',id] as const,pending:['bookings','pending'] as const}
export const myBookingsQuery=()=>queryOptions({queryKey:bookingKeys.mine,queryFn:getMyBookings})
export const bookingQuery=(id:string)=>queryOptions({queryKey:bookingKeys.detail(id),queryFn:()=>getBookingById(id)})
export const pendingBookingsQuery=()=>queryOptions({queryKey:bookingKeys.pending,queryFn:getPendingBookings})
