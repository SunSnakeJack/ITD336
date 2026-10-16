import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { adminBookingsQuery, bookingKeys } from '../../bookings/booking.queries'
import { approveBooking, rejectBooking } from '../../bookings/booking.service'
import type { BookingStatus } from '../../bookings/booking.types'
import { activeKeyLoansQuery, keyLoanKeys } from '../../keys/key.queries'
import type { AdminKeyLoan } from '../../keys/key.types'
import { keyStatusLabel } from '../../keys/utils/key-status.utils'

const bookingLabels:Record<BookingStatus,string>={PENDING:'รออนุมัติ',APPROVED:'อนุมัติแล้ว',REJECTED:'ไม่อนุมัติ',CANCELLED:'ยกเลิก',IN_USE:'กำลังใช้งาน',COMPLETED:'เสร็จสิ้น',NO_SHOW:'ไม่มาใช้งาน',SUPERSEDED:'ถูกแทนที่'}
const formatter=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'})

function keyActionLabel(status:AdminKeyLoan['status']){
  if(status==='REQUESTED')return 'รอระบบตรวจสอบสิทธิ์'
  if(status==='APPROVED')return 'ผู้ใช้พร้อมยืนยันการเบิก'
  if(status==='CHECKED_OUT'||status==='LATE')return 'ผู้ใช้กำลังถือกุญแจ'
  if(status==='RETURN_REPORTED')return 'รอตรวจรับกุญแจ'
  if(status==='LOST'||status==='DAMAGED')return 'รอดำเนินการ'
  return 'ปิดรายการแล้ว'
}

export function AdminBookingsPage(){
  const [tab,setTab]=useState<'bookings'|'keys'>('bookings')
  const client=useQueryClient()
  const bookings=useQuery(adminBookingsQuery())
  const keys=useQuery(activeKeyLoansQuery())
  const refresh=()=>Promise.all([client.invalidateQueries({queryKey:bookingKeys.admin}),client.invalidateQueries({queryKey:keyLoanKeys.all})])
  const approve=useMutation({mutationFn:(id:string)=>approveBooking(id,'อนุมัติจากหน้ารายการจอง'),onSuccess:refresh})
  const reject=useMutation({mutationFn:({id,reason}:{id:string;reason:string})=>rejectBooking(id,reason),onSuccess:refresh})
  return <section className="content-page"><div className="page-heading"><div><span>BOOKING MANAGEMENT</span><h1>รายการจอง</h1><p>รายการจองห้องและคำขอเบิกกุญแจที่ส่งเข้ามา</p></div></div>
    <div className="inner-tabs" role="tablist"><button className={tab==='bookings'?'active':''} role="tab" aria-selected={tab==='bookings'} onClick={()=>setTab('bookings')}>คำขอจองห้อง</button><button className={tab==='keys'?'active':''} role="tab" aria-selected={tab==='keys'} onClick={()=>setTab('keys')}>คำขอเบิกกุญแจ</button></div>
    {tab==='bookings'&&(bookings.isPending?<LoadingSpinner label="กำลังโหลดรายการจอง…"/>:bookings.error?<p className="panel-error">{bookings.error.message}</p>:!bookings.data?.length?<div className="empty-panel">ยังไม่มีรายการจอง</div>:<div className="data-table"><div className="table-row booking-table table-head"><span>ผู้จอง</span><span>ห้อง</span><span>วันและเวลา</span><span>เหตุผล</span><span>ประเภท / สถานะ</span></div>{bookings.data.map((booking)=><div className="table-row booking-table" key={booking.id}><span><strong>{booking.userName}</strong><small>{booking.bookingCode}</small></span><span><strong>{booking.roomCode}</strong><small>{booking.roomName}</small></span><span>{formatter.format(new Date(booking.startsAt))}<small>ถึง {formatter.format(new Date(booking.endsAt))}</small></span><span>{booking.purpose}</span><span><strong className={booking.requiresKey?'booking-type-key':'booking-type-room'}>{booking.requiresKey?'จองพร้อมเบิกกุญแจ':'จองห้อง'}</strong><small className={`status-badge status-${booking.status.toLowerCase()}`}>{bookingLabels[booking.status]}</small>{booking.status==='PENDING'&&<span className="row-actions"><button disabled={approve.isPending} onClick={()=>approve.mutate(booking.id)}>อนุมัติ</button><button disabled={reject.isPending} onClick={()=>{const reason=window.prompt('ระบุเหตุผลที่ไม่อนุมัติ');if(reason?.trim())reject.mutate({id:booking.id,reason})}}>ไม่อนุมัติ</button></span>}</span></div>)}</div>)}
    {tab==='keys'&&(keys.isPending?<LoadingSpinner label="กำลังโหลดสถานะกุญแจ…"/>:keys.error?<p className="panel-error">{keys.error.message}</p>:!keys.data?.length?<div className="empty-panel">ยังไม่มีรายการกุญแจ</div>:<div className="data-table"><div className="table-row key-request-table table-head"><span>ผู้ยืม</span><span>ห้อง</span><span>แหล่งสิทธิ์</span><span>สถานะ</span><span>การดำเนินการ</span></div>{keys.data.map((loan)=><div className="table-row key-request-table" key={loan.id}><span><strong>{loan.borrower_id.slice(0,8)}…</strong><small>รหัสผู้ใช้งาน</small></span><span><strong>{loan.roomCode}</strong><small>{loan.roomName}</small></span><span>{loan.usage_source==='CLASS_SCHEDULE'?'ตารางเรียน':'การจอง'}</span><span><i className={`status-badge status-${loan.status.toLowerCase()}`}>{keyStatusLabel(loan)}</i></span><span>{keyActionLabel(loan.status)}</span></div>)}</div>)}
    {(approve.error||reject.error)&&<p className="panel-error">{(approve.error||reject.error)?.message}</p>}
  </section>
}
