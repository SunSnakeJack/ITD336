import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { myBookingsQuery } from '../../bookings/booking.queries'
import { myKeyRequestsQuery } from '../../keys/key.queries'
import { notificationHistoryPath, notificationRequestMessage } from '../notification-history'
import { markAllNotificationsRead, markNotificationRead, myNotificationsQuery, notificationKeys, unreadNotificationsQuery } from '../notification.queries'
import './NotificationBell.css'

const labels:Record<string,string>={BOOKING_APPROVED:'อนุมัติการจองแล้ว',BOOKING_REJECTED:'ไม่อนุมัติการจอง',BOOKING_SUBMITTED:'ส่งคำขอจองแล้ว',BOOKING_CONFIRMED:'ยืนยันการจองแล้ว',BOOKING_CANCELLED:'ยกเลิกการจองแล้ว',BOOKING_SUPERSEDED:'การจองถูกแทนที่',KEY_REQUEST_SUBMITTED:'ส่งคำขอเบิกกุญแจแล้ว',KEY_REQUEST_APPROVED:'อนุมัติคำขอกุญแจแล้ว',KEY_REQUEST_REJECTED:'ไม่อนุมัติคำขอกุญแจ',KEY_REQUEST_CANCELLED:'ยกเลิกคำขอกุญแจแล้ว',KEY_REQUEST_IN_USE:'เริ่มใช้งานกุญแจแล้ว',KEY_REQUEST_RETURNED:'คืนกุญแจเรียบร้อยแล้ว',KEY_RETURNED:'บันทึกการคืนกุญแจแล้ว',KEY_RETURN_VERIFIED:'ตรวจสอบการคืนกุญแจแล้ว'}
const dateTime=new Intl.DateTimeFormat('th-TH',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Bangkok'})

export function NotificationBell(){
  const [open,setOpen]=useState(false)
  const bell = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !bell.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])
  const client=useQueryClient()
  const notifications=useQuery(myNotificationsQuery())
  const unread=useQuery(unreadNotificationsQuery())
  const visible = notifications.data?.slice(0, 8) ?? []
  const bookings = useQuery({ ...myBookingsQuery(), enabled: open && visible.some(item => item.related_entity_type === 'booking' && item.related_entity_id) })
  const keyRequests = useQuery({ ...myKeyRequestsQuery(), enabled: open && visible.some(item => item.related_entity_type === 'key_request' && item.related_entity_id) })
  const read=useMutation({mutationFn:markNotificationRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const readAll=useMutation({mutationFn:markAllNotificationsRead,onSuccess:()=>client.invalidateQueries({queryKey:notificationKeys.all})})
  const count=unread.data?.length??0
  return <div className="notification-bell" ref={bell}>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-controls={open ? panelId : undefined}
      aria-label={`การแจ้งเตือนที่ยังไม่อ่าน ${count} รายการ`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M10 4a2 2 0 0 1 4 0m-2 0a5.5 5.5 0 0 0-5.5 5.5v2c0 2.8-1.2 4.1-3 5.5h17c-1.8-1.4-3-2.7-3-5.5v-2A5.5 5.5 0 0 0 12 4z" />
        <path d="M10 19.5a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && <span className="notification-count" data-testid="notification-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <div id={panelId} className="notification-menu" role="dialog" aria-label="การแจ้งเตือน">
      <header>
        <strong>การแจ้งเตือน</strong><small>{count} รายการที่ยังไม่อ่าน</small>
      </header>
      <div className="notification-list">
        {notifications.isPending || unread.isPending ? <p>กำลังโหลด…</p>
          : notifications.error || unread.error ? <p className="panel-error">ไม่สามารถโหลดการแจ้งเตือนได้ กรุณาลองใหม่</p>
          : !notifications.data?.length ? <p>ยังไม่มีการแจ้งเตือน</p>
          : visible.map(item => {
            const path = notificationHistoryPath(item)
            const request = (item.related_entity_type === 'booking' ? bookings.data
              : item.related_entity_type === 'key_request' ? keyRequests.data : undefined)
              ?.find(request => request.id === item.related_entity_id)
            const className = item.read_at ? 'is-read' : 'is-unread'
            const markRead = () => { if (!item.read_at) read.mutate(item.id) }
            const content = <>
              <span className="notification-item-title">
                <strong>{labels[item.type] ?? item.title}</strong>
                {!item.read_at && <span className="notification-new">ใหม่</span>}
              </span>
              <small>{request ? notificationRequestMessage(request) : item.message}</small>
              <time dateTime={item.created_at}>{dateTime.format(new Date(item.created_at))}</time>
            </>
            return path
              ? <Link key={item.id} className={className} to={path} onClick={() => { markRead(); setOpen(false) }}>{content}</Link>
              : <button key={item.id} type="button" className={className} disabled={read.isPending} onClick={markRead}>{content}</button>
          })}
        {(read.error || readAll.error) && <p className="panel-error">ไม่สามารถบันทึกสถานะว่าอ่านแล้วได้ กรุณาลองใหม่</p>}
      </div>
      {count > 0 && <footer>
        <button type="button" disabled={readAll.isPending} onClick={() => readAll.mutate()}>อ่านทั้งหมด</button>
      </footer>}
    </div>}
  </div>
}
