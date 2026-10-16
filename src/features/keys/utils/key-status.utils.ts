import type { AdminKeyLoan } from '../key.types'

export function keyStatusLabel(loan:AdminKeyLoan){
  if(loan.status==='CHECKED_OUT')return 'เบิกกุญแจ'
  if(loan.status==='RETURN_REPORTED')return loan.returnedLate?'คืนกุญแจช้ากว่ากำหนด':'คืนกุญแจ'
  if(loan.status==='DAMAGED')return 'รายงานกุญแจชำรุด'
  if(loan.status==='LOST')return 'รายงานกุญแจสูญหาย'
  const labels={REQUESTED:'รออนุมัติ',APPROVED:'พร้อมเบิกกุญแจ',REJECTED:'ไม่อนุมัติ',RETURNED:'คืนเรียบร้อย',LATE:'เกินกำหนด',CANCELLED:'ยกเลิก'}
  return labels[loan.status as keyof typeof labels]??loan.status
}
