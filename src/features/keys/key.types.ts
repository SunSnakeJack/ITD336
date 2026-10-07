export type KeyLoanStatus='REQUESTED'|'APPROVED'|'REJECTED'|'CHECKED_OUT'|'RETURNED'|'LATE'|'LOST'|'DAMAGED'|'CANCELLED'
export interface KeyLoan { id:string; booking_id:string; key_id:string|null; borrower_id:string; status:KeyLoanStatus; requested_at:string; expected_return_at:string|null; returned_at:string|null }
