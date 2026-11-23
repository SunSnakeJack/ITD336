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

export function KeyRoomCatalogCard({room,identity,keyTag=false,showHistory=true}:{
  room:ScheduleRoom;identity:AuthIdentity|null;keyTag?:boolean;showHistory?:boolean
}){
  const date=today()
  const events=useQuery(publicScheduleEventsQuery({roomId:room.id,from:date,to:date}))
  const history=useQuery({ ...publicKeyRequestHistoryQuery(room.id), enabled: !keyTag && showHistory && room.active && events.isSuccess })
  const otherEvents=events.data?.filter(item => !item.id.startsWith('key-request:')) ?? []
  const timingPolicy=useQuery(keyRequestTimingPolicyQuery())
  const [loginOpen,setLoginOpen]=useState(false)
  const available=events.isSuccess?freeRangesForBangkokDay(events.data,date,new Date(),timingPolicy.data??false):[]
  const requestStart=available[0]?.slice(0,5)??'08:00'
  const requestStartMinutes=Number(requestStart.slice(0,2))*60+Number(requestStart.slice(3,5))
  const requestEndMinutes=requestStartMinutes+30
  const requestEnd=`${String(Math.floor(requestEndMinutes/60)).padStart(2,'0')}:${String(requestEndMinutes%60).padStart(2,'0')}`
  const requestPath=`/keys/rooms/${room.id}/request?date=${date}&start=${requestStart}&end=${requestEnd}`
  const hasAvailability=!events.isSuccess||available.length>0
  const canRequest=room.active&&hasAvailability
  if (keyTag) {
    const schedule = events.isSuccess ? 'ready' : events.isError ? 'error' : 'loading'
    return <KeyRoomTagCard room={room} available={available} schedule={schedule} />
  }
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
    <footer><Link aria-label={`ดูรายละเอียด ${room.code}`} to={`/keys/rooms/${room.id}`}>ดูรายละเอียด <img src={externalLinkIcon} alt=""/></Link>{!canRequest?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" disabled>{room.active?'ไม่มีช่วงเวลาว่าง':'เบิกกุญแจห้องนี้'}</button>:room.requiresSsoForKeyRequest&&!identity?<button aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" onClick={()=>setLoginOpen(true)}>เบิกกุญแจห้องนี้<img src={keyActionArrow} alt=""/></button>:<Link aria-label={`เบิกกุญแจ ${room.code}`} className="primary-action" to={requestPath}>เบิกกุญแจห้องนี้<img src={keyActionArrow} alt=""/></Link>}</footer>
    {loginOpen&&<GoogleSsoModal returnTo={requestPath} onClose={()=>setLoginOpen(false)}/>} 
  </article>
}
