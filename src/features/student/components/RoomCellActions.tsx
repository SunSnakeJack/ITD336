import type { ScheduleCellSelection } from '../../schedules/components/WeeklySchedule'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getRoomSlotPermissions, type RoomSlotPermissions } from '../room-actions.service'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { LoginForm } from '../../auth/components/LoginForm'
import { useState } from 'react'

export function RoomCellActions({ roomId, selection, authenticated, onBook, onRequestKey, onClose }: { roomId?: string; selection: ScheduleCellSelection; authenticated: boolean; onBook?: () => void; onRequestKey?: (permissions:RoomSlotPermissions) => void; onClose: () => void }) {
  const navigate = useNavigate()
  const [showLogin,setShowLogin]=useState(false)
  const startsAt=`${selection.date}T${selection.time}:00+07:00`
  const endsAt=new Date(new Date(startsAt).getTime()+60*60*1000).toISOString()
  const permissions=useQuery({queryKey:['room-slot-permissions',roomId,startsAt],queryFn:()=>getRoomSlotPermissions({roomId:roomId as string,startsAt,endsAt}),enabled:authenticated&&Boolean(roomId),retry:false})
  const chooseBooking = () => { if (!authenticated) { onClose(); navigate('/login'); return } onBook?.() }
  const chooseKey = () => { if (!authenticated) { setShowLogin(true); return } if(permissions.data)onRequestKey?.(permissions.data) }
  return <>{showLogin&&<LoginForm embedded onClose={()=>setShowLogin(false)} onSuccess={()=>setShowLogin(false)}/>}<div className="cell-actions-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="cell-actions" role="dialog" aria-label="ตัวเลือกการใช้ห้อง">
    <header><div><strong>{selection.date} · {selection.time}</strong>{selection.event && <small>{selection.event.title}</small>}{selection.holiday && <small>วันหยุด</small>}</div><button aria-label="ปิด" onClick={onClose}>×</button></header>
    {authenticated&&permissions.isPending?<LoadingSpinner compact label="กำลังตรวจสอบสิทธิ์…"/>:<><div><button type="button" disabled={authenticated&&!permissions.data?.canBook} title={permissions.data?.bookingReason??undefined} onClick={chooseBooking}>จองห้อง</button><button type="button" disabled={authenticated&&!permissions.data?.canRequestKey} title={permissions.data?.keyReason??undefined} onClick={chooseKey}>เบิกกุญแจ</button></div>{authenticated&&(permissions.data?.bookingReason||permissions.data?.keyReason)&&<small className="action-reason">{permissions.data.bookingReason??permissions.data.keyReason}</small>}{permissions.error&&<p className="panel-error">ไม่สามารถตรวจสอบสิทธิ์ได้ กรุณาลองใหม่</p>}</>}
  </div></div></>
}
