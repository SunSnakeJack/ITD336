import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicKeyRequestHistoryQuery } from '../key.queries'
import { bangkokClock, bangkokDateKey, freeRangesForBangkokDay } from '../utils/key-catalog-time'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

export function KeyRoomCatalogCard({room,identity}:{room:ScheduleRoom;identity:AuthIdentity|null}){
  const date=today()
  const events=useQuery(publicScheduleEventsQuery({roomId:room.id,from:date,to:date}))
  const history=useQuery(publicKeyRequestHistoryQuery(room.id))
  const [loginOpen,setLoginOpen]=useState(false)
  const requestPath=`/keys/rooms/${room.id}/request?date=${date}&start=08:00&end=09:00`
  const available=events.isSuccess?freeRangesForBangkokDay(events.data,date):[]
  const hasAvailability=!events.isSuccess||available.length>0
  return <article className={`key-room-card${room.active?'':' disabled'}`}>
    <header><div><strong>{room.code}</strong><span>{room.name}</span><small>{[room.building,room.floor].filter(Boolean).join(' · ')}</small></div><span className={room.active&&hasAvailability?'key-room-badge':'key-room-badge unavailable'}>{!room.active?'• ไม่พร้อมใช้':hasAvailability?'• มีช่วงเวลาว่าง':'• ไม่มีช่วงเวลาว่าง'}</span></header>
    <div className="key-free-times"><small>ช่วงเวลาที่เบิกได้วันนี้</small><div>{events.isPending?<span>กำลังโหลด…</span>:events.isError?<span>โหลดตารางไม่สำเร็จ</span>:available.length?available.map((range)=><span key={range}>{range}</span>):<span>ไม่มีช่วงเวลาว่าง</span>}</div></div>
    <div className="key-card-events">{history.isPending?<p>กำลังโหลดรายการ…</p>:history.isError?<p>โหลดรายการไม่สำเร็จ</p>:history.data.length?history.data.slice(0,3).map((item)=><p key={item.id}><span title={item.requesterName}>{item.requesterName}</span><time>{bangkokDateKey(item.startsAt)===date?'วันนี้':bangkokDateKey(item.startsAt)} · {bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time></p>):<p>— ไม่มีรายการ —</p>}</div>
    <footer><Link aria-label={`ดูรายละเอียด ${room.code}`} to={`/keys/rooms/${room.id}`}>ดูรายละเอียด ↗</Link>{!hasAvailability?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" disabled>ไม่มีช่วงเวลาว่าง</button>:room.requiresSsoForKeyRequest&&!identity?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" onClick={()=>setLoginOpen(true)}>เบิกกุญแจห้องนี้</button>:<Link aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" to={requestPath}>เบิกกุญแจห้องนี้</Link>}</footer>
    {loginOpen&&<GoogleSsoModal returnTo={requestPath} onClose={()=>setLoginOpen(false)}/>} 
  </article>
}
