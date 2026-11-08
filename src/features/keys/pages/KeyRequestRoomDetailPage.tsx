import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { publicKeyRequestHistoryQuery } from '../key.queries'
import { bangkokClock } from '../utils/key-catalog-time'
import { isSelectableRange, isTimeSelected } from '../utils/key-slot-selection'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'

const SLOTS = Array.from({ length: 21 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
const bangkokDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const roomTypeLabel=(value:string)=>({['Computer Room']:'ห้องปฏิบัติการคอมพิวเตอร์โน้ตบุ๊ก',['Studio Room']:'ห้องสตูดิโอ',['Gaming Room']:'ห้องปฏิบัติการ E-Sport',['E-Learning Room']:'ห้องผลิตสื่อ e-learning'}[value]??value)

export function KeyRequestRoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((candidate) => candidate.id === roomId)
  const date = useMemo(bangkokDate, [])
  const events = useQuery(publicScheduleEventsQuery({ roomId, from: date, to: date }))
  const history = useQuery(publicKeyRequestHistoryQuery(roomId))
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [selectionNotice,setSelectionNotice]=useState<string|null>(null)

  useEffect(()=>{if(!selectionNotice)return;const timer=window.setTimeout(()=>setSelectionNotice(null),3000);return()=>window.clearTimeout(timer)},[selectionNotice])

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (!room || room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />

  const occupied = (time: string) => (events.data ?? []).some((event) => time >= bangkokClock(event.startsAt) && time < bangkokClock(event.endsAt))
  const selectSlot = (time: string) => {
    if (occupied(time)){setSelectionNotice('ช่วงเวลานี้ไม่ว่าง กรุณาเลือกเวลาอื่น');return}
    if(time==='18:00'&&(!start||end)){setSelectionNotice('เวลา 18:00 ใช้เป็นเวลาสิ้นสุดเท่านั้น');return}
    if(start===time){setStart(null);setEnd(null);setSelectionNotice(null);return}
    if (!start || end) { setStart(time); setEnd(null);setSelectionNotice(null); return }
    if (time > start) {
      if(isSelectableRange(start,time,SLOTS,occupied)){setEnd(time);setSelectionNotice(null)}
      else setSelectionNotice('ไม่สามารถเลือกช่วงเวลานี้ได้ เนื่องจากมีรายการใช้งานห้องคั่นอยู่')
      return
    }
    setStart(time)
    setEnd(null)
    setSelectionNotice(null)
  }
  const requestPath = `/keys/rooms/${room.id}/request?date=${date}&start=${start ?? '08:00'}&end=${end ?? '09:00'}`

  return <section className="key-request-entry key-room-detail">
    <Link className="back-link" to="/keys">← กลับ</Link>
    <header><h1>ห้อง {room.code}</h1><p>{room.name} · ชั้น {room.floor ?? '4'}</p></header>
    <article className="key-detail-card"><div className="key-room-photo" role="img" aria-label={`ภาพห้อง ${room.code}`}>⌨</div><div><h2>ข้อมูลห้อง</h2><p><strong>ประเภท</strong><br />{roomTypeLabel(room.roomTypeName)}</p><p><strong>ความจุ</strong><br />{room.capacity} ที่นั่ง</p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>ไมโครโฟน · ลำโพง · กระดานไวท์บอร์ด</span></footer></article>
    <article className="key-detail-card key-history"><h2>รายการผู้เบิกกุญแจ</h2>{history.data?.length ? <ul>{history.data.map((item)=><li key={item.id}><span title={item.requesterName}>{item.requesterName}</span><time>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time></li>)}</ul>:<p>ยังไม่มีประวัติการเบิกกุญแจ</p>}</article>
    <article className="key-detail-card"><div className="key-schedule-heading" data-testid="key-schedule-heading"><h2>ตารางเวลาการเบิกกุญแจ</h2><time>{date}</time></div><div className="key-slot-grid">{SLOTS.map((time) => { const unavailable = time==='18:00'?occupied('17:30'):occupied(time); const selected = isTimeSelected(time,start,end); return <button key={time} type="button" aria-disabled={unavailable} className={unavailable?'unavailable':selected?'selected':''} onClick={() => selectSlot(time)}><strong>{time}</strong><small>{unavailable ? 'ไม่ว่าง' : selected ? 'เลือก' : 'ว่าง'}</small></button> })}</div>{selectionNotice&&<p className="key-selection-notice" role="alert">{selectionNotice}</p>}{start && <div className="key-time-summary"><span>เวลาเริ่มต้น<strong>{start}</strong></span><span>เวลาสิ้นสุด<strong>{end ?? 'กรุณาเลือก'}</strong></span></div>}</article>
    {room.requiresSsoForKeyRequest && !identity ? <button className="primary-action" onClick={() => setShowLogin(true)}>เบิกกุญแจห้องนี้</button> : <Link className="primary-action" aria-disabled={!room.active || !start || !end} to={room.active && start && end ? requestPath : '#'}>เบิกกุญแจห้องนี้</Link>}
    {showLogin && <GoogleSsoModal returnTo={requestPath} onClose={() => setShowLogin(false)} />}
  </section>
}
