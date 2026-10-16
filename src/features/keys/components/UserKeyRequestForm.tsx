import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestBookingKey, requestClassKey } from '../key.service'
import { keyLoanKeys } from '../key.queries'
import { scheduleKeys } from '../../schedules/schedule.queries'

export function UserKeyRequestForm({roomId,classScheduleId,bookingId,date,time,onClose}:{roomId:string;classScheduleId:string|null;bookingId:string|null;date:string;time:string;onClose:()=>void}){
  const [reason,setReason]=useState('')
  const client=useQueryClient()
  const startsAt=`${date}T${time}:00+07:00`
  const endsAt=new Date(new Date(startsAt).getTime()+60*60*1000).toISOString()
  const save=useMutation({mutationFn:()=>classScheduleId?requestClassKey({roomId,classScheduleId,startsAt,endsAt,notes:reason}):requestBookingKey(bookingId as string,reason),onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:keyLoanKeys.all}),client.invalidateQueries({queryKey:scheduleKeys.all})]);onClose()}})
  return <div className="schedule-dialog-backdrop" role="presentation"><form className="schedule-dialog user-booking-dialog" aria-label="เบิกกุญแจห้อง" onSubmit={(event)=>{event.preventDefault();save.mutate()}}><header><div><h2>เบิกกุญแจห้อง</h2><p>{date} · {time}</p></div><button type="button" aria-label="ปิด" onClick={onClose}>×</button></header><label className="booking-reason">เหตุผลในการเบิก<input autoFocus required value={reason} onChange={(event)=>setReason(event.target.value)}/></label>{save.error&&<p className="panel-error">{save.error.message}</p>}<div className="form-actions"><span/><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending?'กำลังส่งคำขอ…':'ยืนยันการเบิกกุญแจ'}</button></div></form></div>
}
