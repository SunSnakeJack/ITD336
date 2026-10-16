import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { reportKeyStatus } from '../../keys/key.service'
import { keyLoanKeys, myKeyLoanDetailsQuery } from '../../keys/key.queries'
import type { KeyLoanDetail, KeyLoanStatus } from '../../keys/key.types'
import { bookingKeys, myBookingsQuery } from '../booking.queries'
import { cancelBooking } from '../booking.service'
import type { BookingStatus } from '../booking.types'

const bookingLabels:Record<BookingStatus,string>={PENDING:'รออนุมัติ',APPROVED:'อนุมัติแล้ว',REJECTED:'ไม่อนุมัติ',CANCELLED:'ยกเลิก',IN_USE:'กำลังใช้งาน',COMPLETED:'เสร็จสิ้น',NO_SHOW:'ไม่มาใช้งาน',SUPERSEDED:'ถูกแทนที่'}
const keyLabels:Record<KeyLoanStatus,string>={REQUESTED:'รออนุมัติ',APPROVED:'พร้อมรับกุญแจ',REJECTED:'ไม่อนุมัติ',CHECKED_OUT:'เบิกแล้ว',RETURN_REPORTED:'แจ้งคืนแล้ว',RETURNED:'คืนเรียบร้อย',LATE:'เกินกำหนด',LOST:'สูญหาย',DAMAGED:'ชำรุด',CANCELLED:'ยกเลิก'}
const dateTime=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'})
const dateOnly=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'})
const bangkokDateKey=(value:Date)=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find((part)=>part.type===type)?.value??'';return `${get('year')}-${get('month')}-${get('day')}`}

function displayKeyStatus(loan:KeyLoanDetail){if(loan.status==='CHECKED_OUT'&&loan.expectedReturnAt){const remaining=new Date(loan.expectedReturnAt).getTime()-Date.now();if(remaining>0&&remaining<=30*60*1000)return 'ใกล้ถึงกำหนด'}if(loan.status==='RETURNED'&&loan.returnedAt&&loan.expectedReturnAt&&new Date(loan.returnedAt)<new Date(loan.expectedReturnAt))return 'คืนก่อนกำหนด';return keyLabels[loan.status]}

function KeyActions({loan,pending,onStatus,onIssue}:{loan:KeyLoanDetail;pending:boolean;onStatus:(action:'CHECKED_OUT'|'RETURNED')=>void;onIssue:(action:'LOST'|'DAMAGED')=>void}){const future=Boolean(loan.availableFrom)&&bangkokDateKey(new Date(loan.availableFrom as string))>bangkokDateKey(new Date());if(loan.status==='APPROVED')return <div className="request-actions"><button disabled={pending||future} title={future?'ยังไม่ถึงวันที่จอง':undefined} onClick={()=>onStatus('CHECKED_OUT')}>เบิกกุญแจแล้ว</button>{future&&<small className="key-availability-note">สามารถเบิกได้วันที่ {dateOnly.format(new Date(loan.availableFrom as string))}</small>}</div>;if((['CHECKED_OUT','LATE'] as KeyLoanStatus[]).includes(loan.status))return <div className="request-actions"><button disabled={pending} onClick={()=>onStatus('RETURNED')}>คืนกุญแจแล้ว</button><button className="danger-action" disabled={pending} onClick={()=>onIssue('DAMAGED')}>รายงานชำรุด</button><button className="danger-action" disabled={pending} onClick={()=>onIssue('LOST')}>รายงานสูญหาย</button></div>;return null}

export function AccountRequestsPage(){
 const [tab,setTab]=useState<'bookings'|'keys'>('bookings');const client=useQueryClient();const bookings=useQuery(myBookingsQuery());const keys=useQuery(myKeyLoanDetailsQuery());
 const refresh=()=>Promise.all([client.invalidateQueries({queryKey:bookingKeys.mine}),client.invalidateQueries({queryKey:keyLoanKeys.mine})]);
 const cancel=useMutation({mutationFn:(id:string)=>cancelBooking(id,'ผู้ใช้ยกเลิกการจอง'),onSuccess:refresh});
 const status=useMutation({mutationFn:({id,action,description}:{id:string;action:'CHECKED_OUT'|'RETURNED'|'LOST'|'DAMAGED';description?:string})=>reportKeyStatus(id,action,description),onSuccess:refresh});
 const reportIssue=(id:string,action:'LOST'|'DAMAGED')=>{const description=window.prompt(action==='LOST'?'ระบุรายละเอียดการสูญหาย':'ระบุรายละเอียดความชำรุด');if(description?.trim())status.mutate({id,action,description})};
 return <section className="content-page account-requests"><div className="page-heading"><div><span>MY REQUESTS</span><h1>การจองและกุญแจของฉัน</h1><p>ติดตามรายการจองห้องและสถานะการเบิกกุญแจ</p></div></div>
 <div className="inner-tabs" role="tablist"><button className={tab==='bookings'?'active':''} role="tab" aria-selected={tab==='bookings'} onClick={()=>setTab('bookings')}>การจองห้อง</button><button className={tab==='keys'?'active':''} role="tab" aria-selected={tab==='keys'} onClick={()=>setTab('keys')}>การเบิกกุญแจ</button></div>
 {tab==='bookings'&&(bookings.isPending?<LoadingSpinner label="กำลังโหลดการจอง…"/>:bookings.error?<p className="panel-error">{bookings.error.message}</p>:<div className="request-cards">{bookings.data?.length?bookings.data.map((booking)=><article key={booking.id}><header><div><strong>{booking.roomCode}</strong><small>{booking.roomName}</small></div><i className={`status-badge status-${booking.status.toLowerCase()}`}>{bookingLabels[booking.status]}</i></header><p>{booking.purpose}</p><small>{dateTime.format(new Date(booking.startsAt))} – {dateTime.format(new Date(booking.endsAt))}</small>{(['PENDING','APPROVED'] as BookingStatus[]).includes(booking.status)&&<button className="danger-action" disabled={cancel.isPending} onClick={()=>{if(window.confirm('ยืนยันการยกเลิกการจองนี้?'))cancel.mutate(booking.id)}}>ยกเลิกการจอง</button>}</article>):<div className="empty-panel">ยังไม่มีรายการจอง</div>}</div>)}
 {tab==='keys'&&(keys.isPending?<LoadingSpinner label="กำลังโหลดข้อมูลกุญแจ…"/>:keys.error?<p className="panel-error">{keys.error.message}</p>:<div className="request-cards">{keys.data?.length?keys.data.map((loan)=><article key={loan.id}><header><div><strong>{loan.roomCode}</strong><small>{loan.keyCode??'บันทึกระดับห้อง'}</small></div><i className={`status-badge status-${loan.status.toLowerCase()}`}>{displayKeyStatus(loan)}</i></header><p>{loan.usageSource==='CLASS_SCHEDULE'?'สิทธิ์จากตารางเรียน':'สิทธิ์จากการจองห้อง'}</p>{loan.expectedReturnAt&&<small>กำหนดคืน {dateTime.format(new Date(loan.expectedReturnAt))}</small>}<KeyActions loan={loan} pending={status.isPending} onStatus={(action)=>status.mutate({id:loan.id,action})} onIssue={(action)=>reportIssue(loan.id,action)}/></article>):<div className="empty-panel">ยังไม่มีรายการเบิกกุญแจ</div>}</div>)}
 {(cancel.error||status.error)&&<p className="panel-error">{(cancel.error||status.error)?.message}</p>}</section>
}
