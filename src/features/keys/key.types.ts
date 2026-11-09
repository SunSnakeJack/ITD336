export type KeyLoanStatus='REQUESTED'|'APPROVED'|'REJECTED'|'CHECKED_OUT'|'RETURN_REPORTED'|'RETURNED'|'LATE'|'LOST'|'DAMAGED'|'CANCELLED'
export type KeyUsageSource='BOOKING'|'CLASS_SCHEDULE'|'DIRECT_USAGE'
export interface KeyLoan { id:string; booking_id:string|null; room_id:string; key_id:string|null; borrower_id:string; usage_source:KeyUsageSource; status:KeyLoanStatus; requested_at:string; expected_return_at:string|null; user_reported_return_at:string|null; returned_at:string|null }
export interface KeyLoanDetail { id:string;roomId:string;roomCode:string;keyCode:string|null;usageSource:KeyUsageSource;status:KeyLoanStatus;checkedOutAt:string|null;expectedReturnAt:string|null;availableFrom:string|null;reportedReturnAt:string|null;returnedAt:string|null;overdue:boolean }
export interface AdminKeyLoan extends KeyLoan { roomCode:string;roomName:string;keyCode:string|null;returnedLate:boolean;borrowerName:string|null;borrowerUniversityId:string|null;borrowerEmail:string|null }
export interface AvailableRoomKey { id:string;roomId:string;keyCode:string }
export interface KeyCabinetRoom { roomId:string;roomCode:string;roomName:string;roomActive:boolean;keyStatus:'ROOM_CLOSED'|'AVAILABLE'|'CHECKED_OUT'|'OVERDUE';availableKeys:number;heldKeys:number }

export interface CreateKeyRequestInput {
  roomId: string
  requesterName: string
  requesterEmail: string
  purposeType: 'TEACHING' | 'OTHER'
  purpose: string
  startsAt: string
  endsAt: string
  courseCode?: string
  courseName?: string
  lecturerName?: string
  lecturerEmail?: string
  requesterType?: 'STUDENT' | 'TEACHER'
  requesterIdentifier?: string
  referenceOptionId?: string
}

export interface KeyRequestResult {
  id: string
  request_code: string
  status: 'APPROVED' | 'PENDING_APPROVAL'
  email_dispatch_token: string
}

export interface PublicKeyRequestHistoryItem { id:string;requesterName:string;startsAt:string;endsAt:string;status:string }
export interface KeyRequestReferenceOption { id:string;courseCode:string;courseName:string;lecturerName:string }
export interface MyKeyRequest {id:string;requestCode:string;roomCode:string;roomName:string;roomTypeName:string;floor:string|null;startsAt:string;endsAt:string;purpose:string;purposeType:'TEACHING'|'OTHER';courseCode:string|null;lecturerName:string|null;status:string;canCancel:boolean}
