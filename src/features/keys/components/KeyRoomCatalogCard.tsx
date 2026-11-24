import { roomSlotTimes } from '../../schedules/request-time-options'
import { hasViewerPermission, keyRequestPermission, useViewerPermissions } from '../../auth/viewer-permissions.queries'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import type { AuthIdentity } from '../../auth/auth.types'
import { bangkokClock, freeRangesForBangkokDay } from '../utils/key-catalog-time'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import keyRoomIcon from '../../../assets/key-room.svg'
import externalLinkIcon from '../../../assets/external-link.svg'
import keyActionArrow from '../../../assets/key-action-arrow.svg'
import { keyRequestTimingPolicyQuery, publicKeyRequestHistoryQuery } from '../key.queries'
import { RoomUsageHistory } from '../../schedules/components/RoomUsageHistory'
import { KeyRoomTagCard } from './KeyRoomTagCard'

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())

export function KeyRoomCatalogCard({room,identity,keyTag=false,showHistory=true,service='open'}:{
  room:ScheduleRoom;identity:AuthIdentity|null;keyTag?:boolean;showHistory?:boolean;service?:'open'|'closed'|'loading'|'error'
}){
  const access = useViewerPermissions(identity)
  const permitted = hasViewerPermission(access.data, keyRequestPermission(room.requiresSsoForKeyRequest))
  const denied = Boolean(identity && access.isSuccess && !permitted)
  const checking = access.isPending
  const needsSignIn = !identity && (room.requiresLoginForKeyRequest || !permitted)
  const date=today()
  const events=useQuery({ ...publicScheduleEventsQuery({roomId:room.id,from:date,to:date}), enabled: service === 'open' && !denied && !checking })
  const history=useQuery({ ...publicKeyRequestHistoryQuery(room.id), enabled: !denied && !checking && !keyTag && showHistory && room.active && events.isSuccess })
  const otherEvents=events.data?.filter(item => !item.id.startsWith('key-request:')) ?? []
  const timingPolicy=useQuery(keyRequestTimingPolicyQuery())
  const [loginOpen,setLoginOpen]=useState(false)
  const available=events.isSuccess?freeRangesForBangkokDay(events.data,date,new Date(),timingPolicy.data??false,room.operatingHours):[]
  const slots = roomSlotTimes(room.operatingHours)
  const firstSlot = slots.slice(0, -1).findIndex((time, index) =>
    !events.isSuccess || available.some(range => time >= range.slice(0, 5) && slots[index + 1] <= range.slice(6, 11)),
  )
  const requestStart = slots[firstSlot]
  const requestEnd = slots[firstSlot + 1]
  const requestPath=`/keys/rooms/${room.id}/request?date=${date}&start=${requestStart}&end=${requestEnd}`
  const hasAvailability = firstSlot >= 0
  const canRequest=room.active&&hasAvailability&&service==='open'
  if (keyTag) {
    const schedule = service !== 'open' ? service : denied ? 'denied' : checking ? 'checking' : access.isError ? 'error' : events.isSuccess ? 'ready' : events.isError ? 'error' : 'loading'
    return <KeyRoomTagCard room={room} available={available} schedule={schedule} />
  }
  if (service !== 'open' || denied || checking || access.isError) return <article className="key-room-card key-room-catalog-card disabled">
    <header><strong>{room.code}</strong><span className="key-room-badge unavailable">
      {service === 'closed' ? 'งดให้บริการวันนี้' : denied ? 'บัญชีนี้ไม่มีสิทธิ์เบิกกุญแจห้องนี้' : checking ? 'กำลังตรวจสอบสิทธิ์…' : access.isError ? 'ตรวจสอบสิทธิ์ไม่สำเร็จ' : service === 'error' ? 'ตรวจสอบวันให้บริการไม่สำเร็จ' : 'กำลังตรวจสอบวันให้บริการ…'}
    </span></header>
  </article>
  return <article className={`key-room-card key-room-catalog-card${room.active?'':' disabled'}`}>
    <header><div className="key-room-identity"><img src={keyRoomIcon} alt=""/><span><strong>{room.code}</strong><small className="key-room-name">{room.description||room.name}</small></span></div><span className={room.active&&hasAvailability?'key-room-badge':'key-room-badge unavailable'}>{!room.active?'• ไม่พร้อมใช้':hasAvailability?'• มีช่วงเวลาว่าง':'• ไม่มีช่วงเวลาว่าง'}</span></header>
    <div className="key-free-times"><small>{room.active?'ช่วงเวลาที่เบิกได้':'ไม่มีช่วงเวลาที่เบิกได้'}</small>{room.active&&<div>{events.isPending?<span>กำลังโหลด…</span>:events.isError?<span>โหลดตารางไม่สำเร็จ</span>:available.length?available.map((range)=><span key={range}>{range}</span>):<span>ไม่มีช่วงเวลาว่าง</span>}</div>}</div>
    {room.active && (showHistory || otherEvents.length > 0) && <div className="key-card-events">
      {otherEvents.length > 0 && <section className="key-booking-day">
        <h3>ตารางใช้งานวันนี้</h3>
        {otherEvents.slice(0, 3).map(item => <p key={item.id}><span title={item.title}>{item.title}</span><time>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time></p>)}
      </section>}
      {showHistory && (events.isError || history.isError ? <p>โหลดรายการเบิกไม่สำเร็จ</p>
        : events.isPending || history.isPending ? <p>กำลังโหลดรายการเบิก…</p>
        : history.data.length ? <RoomUsageHistory items={history.data.map(item => ({ ...item, title: item.requesterName }))}
          label="รายการเบิกล่าสุด" heading="รายการเบิก" />
        : <p>— ไม่มีรายการเบิก —</p>)}
    </div>}
    <footer><Link aria-label={`ดูรายละเอียด ${room.code}`} to={`/keys/rooms/${room.id}`}>ดูรายละเอียด <img src={externalLinkIcon} alt=""/></Link>{!canRequest || access.isPending || access.isError || (identity && !permitted) ?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" disabled>{identity && access.isSuccess && !permitted ? 'ไม่มีสิทธิ์เบิกกุญแจ' : room.active && !hasAvailability ? 'ไม่มีช่วงเวลาว่าง' : 'เบิกกุญแจห้องนี้'}</button>:needsSignIn?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" onClick={()=>setLoginOpen(true)}>เบิกกุญแจห้องนี้<img src={keyActionArrow} alt=""/></button>:<Link aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" to={requestPath}>เบิกกุญแจห้องนี้<img src={keyActionArrow} alt=""/></Link>}</footer>
    {loginOpen&&<GoogleSsoModal returnTo={requestPath} onClose={()=>setLoginOpen(false)}/>} 
  </article>
}
