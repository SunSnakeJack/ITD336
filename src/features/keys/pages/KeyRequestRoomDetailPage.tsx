import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { publicKeyRequestHistoryQuery } from '../key.queries'
import { bangkokClock, isSlotElapsedForBangkokDate } from '../utils/key-catalog-time'
import { isSelectableRange, isTimeSelected } from '../utils/key-slot-selection'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import defaultRoomImage from '../../../assets/default-room.jpg'
import './KeyRequestRoomDetailPage.css'

const SLOTS = Array.from({ length: 21 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
const bangkokDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const thaiDate = (date:string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday:'long',year:'numeric',month:'long',day:'numeric' }).format(new Date(`${date}T00:00:00+07:00`))
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
  const isUnavailable = (time: string) => {
    const target = time === '18:00' ? '17:30' : time
    return occupied(target) || isSlotElapsedForBangkokDate(target, date)
  }
  const selectSlot = (time: string) => {
    if (isUnavailable(time)){setSelectionNotice('ช่วงเวลานี้ไม่ว่าง กรุณาเลือกเวลาอื่น');return}
    if(time==='18:00'&&(!start||end)){setSelectionNotice('เวลา 18:00 ใช้เป็นเวลาสิ้นสุดเท่านั้น');return}
    if(start===time){setStart(null);setEnd(null);setSelectionNotice(null);return}
    if (!start || end) { setStart(time); setEnd(null);setSelectionNotice(null); return }
    if (time > start) {
      if(isSelectableRange(start,time,SLOTS,isUnavailable)){setEnd(time);setSelectionNotice(null)}
      else setSelectionNotice('ไม่สามารถเลือกช่วงเวลานี้ได้ เนื่องจากมีรายการใช้งานห้องคั่นอยู่')
      return
    }
    setStart(time)
    setEnd(null)
    setSelectionNotice(null)
  }
  const requestPath = `/keys/rooms/${room.id}/request?date=${date}&start=${start ?? '08:00'}&end=${end ?? '09:00'}`
  const canRequest=room.active&&Boolean(start&&end)
  const clearSelection=()=>{setStart(null);setEnd(null);setSelectionNotice(null)}

  return <section className="key-request-entry key-room-detail">
    <Link className="back-link" to="/keys">← กลับ</Link>
    <header className="key-detail-heading"><h1>ห้อง {room.code}</h1><p>{room.name}{room.building?` · ${room.building}`:''}{room.floor?` · ชั้น ${room.floor}`:''}</p><div className="key-detail-metadata"><span>{room.active?'เปิดใช้งาน':'ไม่พร้อมใช้'}</span><span>{room.requiresSsoForKeyRequest?'ต้องเข้าสู่ระบบ':'ไม่ต้องเข้าสู่ระบบ'}</span><span>{room.requiresSsoForKeyRequest?'รออนุมัติ':'ไม่ต้องรออนุมัติ'}</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" loading="lazy" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทคอมพิวเตอร์</small><strong>{roomTypeLabel(room.roomTypeName)}</strong></p><p><small>ความจุ</small><strong>{room.capacity>0?`${room.capacity} ที่นั่ง`:'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม</span></footer></article>
    <article className="key-detail-card key-history"><h2>รายการผู้เบิกกุญแจ</h2><time className="key-history-date">{thaiDate(date)}</time>{history.isPending?<p className="key-detail-empty">กำลังโหลดรายการ…</p>:history.isError?<p className="key-detail-empty">ไม่สามารถโหลดรายการได้</p>:history.data?.length ? <ul>{history.data.map((item)=><li key={item.id}><span title={item.requesterName}>{item.requesterName}</span><time>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time></li>)}</ul>:<p className="key-detail-empty">— ยังไม่มีรายการ —</p>}</article>
    <article className="key-detail-card key-schedule-card"><div className="key-schedule-heading" data-testid="key-schedule-heading"><h2>ตารางเวลาการเบิกกุญแจ</h2><time dateTime={date}>{thaiDate(date)}<span className="sr-only"> ({date})</span></time><p>แตะครั้งแรกเพื่อเลือกเวลาเริ่มต้น แล้วแตะช่วงสุดท้ายที่ต้องการใช้งาน</p></div><div className="key-slot-legend" aria-label="สถานะช่วงเวลา"><span><i/>ว่าง</span><span><i/>จองแล้ว</span><span><i/>เลือกแล้ว</span></div><div className="key-slot-grid">{SLOTS.map((time) => { const unavailable = isUnavailable(time); const selected = isTimeSelected(time,start,end); const label=unavailable?'ไม่ว่าง':time===start?'เลือก - เริ่ม':time===end?'เลือก - จบ':selected?'เลือก':'ว่าง'; return <button key={time} type="button" aria-disabled={unavailable} className={unavailable?'unavailable':selected?'selected':''} onClick={() => selectSlot(time)}><strong>{time}</strong><small>{label}</small></button> })}</div>{selectionNotice&&<p className="key-selection-notice" role="alert">{selectionNotice}</p>}{start && <div className="key-selected-time"><div className="key-time-summary"><span>เวลาเริ่มต้น<strong>{start}</strong></span><span>เวลาสิ้นสุด<strong>{end ?? 'กรุณาเลือก'}</strong></span></div><button type="button" className="key-reset-selection" onClick={clearSelection}>เลือกช่วงเวลาใหม่</button></div>}</article>
    {room.requiresSsoForKeyRequest && !identity ? <button className="primary-action" disabled={!canRequest} onClick={() => setShowLogin(true)}>เบิกกุญแจห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>เบิกกุญแจห้องนี้</Link>}
    {showLogin && <GoogleSsoModal returnTo={requestPath} onClose={() => setShowLogin(false)} />}
  </section>
}
