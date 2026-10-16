import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { markAllNotificationsRead, markNotificationRead, notificationKeys, unreadNotificationsQuery } from '../notification.queries'

const labels:Record<string,string>={BOOKING_APPROVED:'อนุมัติการจองแล้ว',BOOKING_REJECTED:'ไม่อนุมัติการจอง',BOOKING_SUBMITTED:'ส่งคำขอจองแล้ว',BOOKING_CONFIRMED:'ยืนยันการจองแล้ว'}
const dateTime=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'})

export function NotificationBell(){
  const [open,setOpen]=useState(false)
  const client=useQueryClient()
  const notifications=useQuery(unreadNotificationsQuery())
  const read=useMutation({mutationFn:markNotificationRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const readAll=useMutation({mutationFn:markAllNotificationsRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const count=notifications.data?.length??0
  return <div className="notification-bell"><button type="button" aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${count} รายการ`} aria-expanded={open} onClick={()=>setOpen(!open)}>🔔{count>0&&<span>{count>99?'99+':count}</span>}</button>{open&&<div className="notification-menu" role="dialog" aria-label="การแจ้งเตือน"><header><span><strong>การแจ้งเตือน</strong><small>{count} รายการที่ยังไม่อ่าน</small></span>{count>0&&<button disabled={readAll.isPending} onClick={()=>readAll.mutate()}>อ่านทั้งหมด</button>}</header>{notifications.isPending?<p>กำลังโหลด…</p>:count===0?<p>ไม่มีการแจ้งเตือนใหม่</p>:notifications.data?.slice(0,8).map((item)=><button key={item.id} disabled={read.isPending} onClick={()=>read.mutate(item.id)}><strong>{labels[item.type]??item.title}</strong><small>{item.message}</small><time>{dateTime.format(new Date(item.created_at))}</time></button>)}{(read.error||readAll.error)&&<p className="panel-error">ไม่สามารถบันทึกสถานะว่าอ่านแล้วได้ กรุณาลองใหม่</p>}</div>}</div>
}
