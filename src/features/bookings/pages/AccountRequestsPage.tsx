import { AccountRequestAction, AccountRequestCard, AccountRequestTime } from '../components/AccountRequestCard'
import { EditableRequestCard } from '../components/EditableRequestCard'
import { AccountKeyRequestHistoryPage } from '../../keys/pages/AccountKeyRequestHistoryPage'
import { useSearchParams } from 'react-router-dom'
import { useRequestFocus } from '../../../shared/components/useRequestFocus'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { reportKeyStatus } from '../../keys/key.service'
import { keyLoanKeys, myKeyLoanDetailsQuery } from '../../keys/key.queries'
import type { KeyLoanDetail, KeyLoanStatus } from '../../keys/key.types'
import { bookingKeys, myBookingsQuery } from '../booking.queries'
import { cancelBooking } from '../booking.service'
import { canCancelBooking } from '../booking-status.utils'
import { accountBookingApprovalStatus, accountBookingStatus, accountKeyLoanStatus } from '../account-request-status'
import { PublicPageHeading } from '../../../shared/components/PublicPageHeading'
import { RecentRequestsHeading } from '../components/RecentRequestsHeading'

const dateTime=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'})
const dateOnly=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'})
const bangkokDateKey=(value:Date)=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find((part)=>part.type===type)?.value??'';return `${get('year')}-${get('month')}-${get('day')}`}

function KeyActions({loan,pending,onStatus,onIssue}:{loan:KeyLoanDetail;pending:boolean;onStatus:(action:'CHECKED_OUT'|'RETURNED')=>void;onIssue:(action:'LOST'|'DAMAGED')=>void}){const future=Boolean(loan.availableFrom)&&bangkokDateKey(new Date(loan.availableFrom as string))>bangkokDateKey(new Date());if(loan.status==='APPROVED')return <div className="account-request-card-actions"><AccountRequestAction variant="neutral" disabled={pending||future} title={future?'ยังไม่ถึงวันที่จอง':undefined} onClick={()=>onStatus('CHECKED_OUT')}>เบิกกุญแจแล้ว</AccountRequestAction>{future&&<small className="key-availability-note">สามารถเบิกได้วันที่ {dateOnly.format(new Date(loan.availableFrom as string))}</small>}</div>;if((['CHECKED_OUT','LATE'] as KeyLoanStatus[]).includes(loan.status))return <div className="account-request-card-actions"><AccountRequestAction variant="return" disabled={pending} onClick={()=>onStatus('RETURNED')}>คืนกุญแจแล้ว</AccountRequestAction><button className="danger-action" disabled={pending} onClick={()=>onIssue('DAMAGED')}>รายงานชำรุด</button><button className="danger-action" disabled={pending} onClick={()=>onIssue('LOST')}>รายงานสูญหาย</button></div>;return null}

export function AccountRequestsPage(){
 const [params, setParams] = useSearchParams()
 const tab = params.get('tab') === 'keys' ? 'keys' : 'bookings'
 const setTab = (next: 'bookings' | 'keys') => setParams(next === 'keys' ? { tab: 'keys' } : {})
 const client = useQueryClient()
 const bookings = useQuery(myBookingsQuery())
 const keys = useQuery({ ...myKeyLoanDetailsQuery(), enabled: tab === 'keys' })
 const requestFocus = useRequestFocus(tab === 'bookings' ? bookings.isSuccess : keys.isSuccess)
 const refresh=()=>Promise.all([client.invalidateQueries({queryKey:bookingKeys.mine}),client.invalidateQueries({queryKey:keyLoanKeys.mine})]);
 const cancel=useMutation({mutationFn:(id:string)=>cancelBooking(id,'ผู้ใช้ยกเลิกการจอง'),onSuccess:refresh});
 const status=useMutation({mutationFn:({id,action,description}:{id:string;action:'CHECKED_OUT'|'RETURNED'|'LOST'|'DAMAGED';description?:string})=>reportKeyStatus(id,action,description),onSuccess:refresh});
 const reportIssue=(id:string,action:'LOST'|'DAMAGED')=>{const description=window.prompt(action==='LOST'?'ระบุรายละเอียดการสูญหาย':'ระบุรายละเอียดความชำรุด');if(description?.trim())status.mutate({id,action,description})};
 return <section className="content-page account-requests"><PublicPageHeading title="การจองและกุญแจของฉัน" description="ติดตามรายการจองห้องและสถานะการเบิกกุญแจ" />
 <div className="inner-tabs" role="tablist"><button className={tab==='bookings'?'active':''} role="tab" aria-selected={tab==='bookings'} onClick={()=>setTab('bookings')}>การจองห้อง</button><button className={tab==='keys'?'active':''} role="tab" aria-selected={tab==='keys'} onClick={()=>setTab('keys')}>การเบิกกุญแจ</button></div>
 {tab === 'bookings' && (bookings.isPending ? <LoadingSpinner label="กำลังโหลดการจอง…"/> : bookings.error
   ? <p className="panel-error">{bookings.error.message}</p> : <div className="account-request-card-list">
     <RecentRequestsHeading count={bookings.data?.length ?? 0} />
     {bookings.data?.length ? bookings.data.map(booking => {
       const now = Date.now()
       const basis = booking.approvalDeadlineBasis ?? 'END'
       const expired = booking.status === 'PENDING' && now >= Date.parse(basis === 'START' ? booking.startsAt : booking.endsAt)
       const editable = ['APPROVED', 'PENDING'].includes(booking.status) && Date.parse(booking.startsAt) > now
       return <EditableRequestCard key={booking.id} id={booking.id} type="booking" start={booking.startsAt} end={booking.endsAt} editable={editable} articleProps={requestFocus(booking.id)}
         title={booking.roomName === '—' ? booking.roomCode : booking.roomName}
         status={booking.status === 'PENDING'
           ? accountBookingApprovalStatus(booking.startsAt, booking.endsAt, basis, now)
           : accountBookingStatus(booking.status, booking.endsAt, now)}

         time={<AccountRequestTime start={booking.startsAt} end={booking.endsAt}/>}
         purpose={booking.purpose}
         actions={!expired && canCancelBooking(booking.status, booking.endsAt, now) && <AccountRequestAction variant="cancel"
           disabled={cancel.isPending} onClick={() => {
             if (window.confirm('ยืนยันการยกเลิกการจองนี้?')) cancel.mutate(booking.id)
           }}>ยกเลิก</AccountRequestAction>}/>
     }) : <div className="empty-panel">ยังไม่มีรายการจอง</div>}
   </div>)}
 {tab === 'keys' && <AccountKeyRequestHistoryPage embedded loanCount={keys.data?.length ?? 0} />}
 {tab === 'keys' && (keys.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลกุญแจ…"/> : keys.error
   ? <p className="panel-error">{keys.error.message}</p> : <div className="account-request-card-list">
     {keys.data?.map(loan => <AccountRequestCard key={loan.id} articleProps={requestFocus(loan.id)}
       title={`ห้อง ${loan.roomCode}`} status={accountKeyLoanStatus(loan)}
       time={loan.expectedReturnAt ? `กำหนดคืน ${dateTime.format(new Date(loan.expectedReturnAt))}` : '—'}
       purposeLabel="ที่มาของสิทธิ์"
       purpose={loan.usageSource === 'BOOKING' ? 'สิทธิ์จากการจองห้อง' : loan.usageSource === 'CLASS_SCHEDULE' ? 'สิทธิ์จากตารางเรียน' : 'เบิกกุญแจโดยตรง'}
       actions={<KeyActions loan={loan} pending={status.isPending}
         onStatus={action => status.mutate({ id: loan.id, action })}
         onIssue={action => reportIssue(loan.id, action)}/>}/>)}
   </div>)}
 {(cancel.error||status.error)&&<p className="panel-error">{(cancel.error||status.error)?.message}</p>}</section>
}
