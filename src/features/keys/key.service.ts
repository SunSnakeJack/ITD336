import { supabase, unwrap } from '../../lib/supabase/client'
import type { RpcResult } from '../bookings/booking.types'
import type { KeyLoan } from './key.types'
export const getMyKeyLoans=()=>unwrap<KeyLoan[]>(supabase.from('key_loans').select('*').order('requested_at',{ascending:false}))
export const getActiveKeyLoans=()=>unwrap<KeyLoan[]>(supabase.from('active_key_loans_v').select('*').order('requested_at'))
export const requestKey=(bookingId:string)=>unwrap<RpcResult>(supabase.rpc('request_key',{p_booking_id:bookingId}))
export const approveKeyRequest=(loanId:string,notes?:string)=>unwrap<RpcResult>(supabase.rpc('approve_key_request',{p_key_loan_id:loanId,p_notes:notes??null}))
export const checkoutKey=(loanId:string,keyId:string,expectedReturnAt:string)=>unwrap<RpcResult>(supabase.rpc('checkout_key',{p_key_loan_id:loanId,p_key_id:keyId,p_expected_return_at:expectedReturnAt}))
export const returnKey=(loanId:string,condition:'NORMAL'|'DAMAGED'|'LOST'='NORMAL',notes?:string)=>unwrap<RpcResult>(supabase.rpc('return_key',{p_key_loan_id:loanId,p_condition:condition,p_notes:notes??null}))
