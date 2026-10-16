export type KeyLoanStatus='REQUESTED'|'APPROVED'|'REJECTED'|'CHECKED_OUT'|'RETURN_REPORTED'|'RETURNED'|'LATE'|'LOST'|'DAMAGED'|'CANCELLED'
export type KeyUsageSource='BOOKING'|'CLASS_SCHEDULE'|'DIRECT_USAGE'
export interface KeyLoan { id:string; booking_id:string|null; room_id:string; key_id:string|null; borrower_id:string; usage_source:KeyUsageSource; status:KeyLoanStatus; requested_at:string; expected_return_at:string|null; user_reported_return_at:string|null; returned_at:string|null }
export interface KeyLoanDetail { id:string;roomId:string;roomCode:string;keyCode:string|null;usageSource:KeyUsageSource;status:KeyLoanStatus;checkedOutAt:string|null;expectedReturnAt:string|null;availableFrom:string|null;reportedReturnAt:string|null;returnedAt:string|null;overdue:boolean }
export interface AdminKeyLoan extends KeyLoan { roomCode:string;roomName:string;keyCode:string|null;returnedLate:boolean }
export interface AvailableRoomKey { id:string;roomId:string;keyCode:string }
export interface KeyCabinetRoom { roomId:string;roomCode:string;roomName:string;roomActive:boolean;keyStatus:'ROOM_CLOSED'|'AVAILABLE'|'CHECKED_OUT';availableKeys:number;heldKeys:number }
