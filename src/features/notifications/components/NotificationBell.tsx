import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { markAllNotificationsRead, markNotificationRead, myNotificationsQuery, notificationKeys, unreadNotificationsQuery } from '../notification.queries'
import './NotificationBell.css'

const labels:Record<string,string>={BOOKING_APPROVED:'อนุมัติการจองแล้ว',BOOKING_REJECTED:'ไม่อนุมัติการจอง',BOOKING_SUBMITTED:'ส่งคำขอจองแล้ว',BOOKING_CONFIRMED:'ยืนยันการจองแล้ว',BOOKING_CANCELLED:'ยกเลิกการจองแล้ว',BOOKING_SUPERSEDED:'การจองถูกแทนที่',KEY_REQUEST_SUBMITTED:'ส่งคำขอเบิกกุญแจแล้ว',KEY_REQUEST_APPROVED:'อนุมัติคำขอกุญแจแล้ว',KEY_REQUEST_REJECTED:'ไม่อนุมัติคำขอกุญแจ',KEY_REQUEST_CANCELLED:'ยกเลิกคำขอกุญแจแล้ว',KEY_REQUEST_IN_USE:'เริ่มใช้งานกุญแจแล้ว',KEY_REQUEST_RETURNED:'คืนกุญแจเรียบร้อยแล้ว',KEY_RETURNED:'บันทึกการคืนกุญแจแล้ว',KEY_RETURN_VERIFIED:'ตรวจสอบการคืนกุญแจแล้ว'}
const dateTime=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'})

export function NotificationBell(){
  const [open,setOpen]=useState(false)
  const client=useQueryClient()
  const notifications=useQuery(myNotificationsQuery())
  const unread=useQuery(unreadNotificationsQuery())
  const read=useMutation({mutationFn:markNotificationRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const readAll=useMutation({mutationFn:markAllNotificationsRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const count=unread.data?.length??0
  return <div className="notification-bell"><button type="button" aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${count} รายการ`} aria-expanded={open} onClick={()=>setOpen(!open)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>{count>0&&<span data-testid="notification-dot"/>}</button>{open&&<div className="notification-menu" role="dialog" aria-label="การแจ้งเตือน"><header><span><strong>การแจ้งเตือน</strong><small>{count} รายการที่ยังไม่อ่าน</small></span>{count>0&&<button disabled={readAll.isPending} onClick={()=>readAll.mutate()}>อ่านทั้งหมด</button>}</header>{notifications.isPending||unread.isPending?<p>กำลังโหลด…</p>:notifications.error||unread.error?<p className="panel-error">ไม่สามารถโหลดการแจ้งเตือนได้ กรุณาลองใหม่</p>:!notifications.data?.length?<p>ยังไม่มีการแจ้งเตือน</p>:notifications.data.slice(0,8).map((item)=><button className={item.read_at?'is-read':'is-unread'} key={item.id} disabled={read.isPending} onClick={()=>{if(!item.read_at)read.mutate(item.id)}}><strong>{labels[item.type]??item.title}</strong><small>{item.message}</small><time>{dateTime.format(new Date(item.created_at))}</time></button>)}{(read.error||readAll.error)&&<p className="panel-error">ไม่สามารถบันทึกสถานะว่าอ่านแล้วได้ กรุณาลองใหม่</p>}</div>}</div>
}
