export type KeyLoanStatus='REQUESTED'|'APPROVED'|'REJECTED'|'CHECKED_OUT'|'RETURN_REPORTED'|'RETURNED'|'LATE'|'LOST'|'DAMAGED'|'CANCELLED'
export type KeyUsageSource='BOOKING'|'CLASS_SCHEDULE'|'DIRECT_USAGE'
export interface KeyLoan { id:string; booking_id:string|null; room_id:string; key_id:string|null; borrower_id:string; usage_source:KeyUsageSource; status:KeyLoanStatus; requested_at:string; expected_return_at:string|null; user_reported_return_at:string|null; returned_at:string|null }
