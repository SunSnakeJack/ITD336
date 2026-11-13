import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { bangkokClock, isSlotElapsedForBangkokDate } from '../../keys/utils/key-catalog-time'
import { isSelectableRange, isTimeSelected } from '../../keys/utils/key-slot-selection'
import defaultRoomImage from '../../../assets/default-room.jpg'
import '../../keys/pages/KeyRequestRoomDetailPage.css'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'

const SLOTS = Array.from({ length: 21 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
const thaiDate = (date: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T00:00:00+07:00`))

export function MeetingRoomEntryPage() {
  const rooms = useQuery(publicRoomsQuery())
  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้องประชุม…" />
  const room = rooms.data?.find((item) => item.usageScope === 'MEETING')
  return room ? <Navigate to={`/meeting-room/${room.id}`} replace /> : <section className="key-request-entry"><h1>ห้องประชุม</h1><p>ยังไม่มีห้องประชุมที่เปิดให้ใช้งาน</p></section>
}

export function MeetingRoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const date = useMemo(today, [])
  const events = useQuery(publicScheduleEventsQuery({ roomId, from: date, to: date }))
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้องประชุม…" />
  if (!room || room.usageScope !== 'MEETING') return <Navigate to="/meeting-room" replace />

  const occupied = (time: string) => (events.data ?? []).some((event) => time >= bangkokClock(event.startsAt) && time < bangkokClock(event.endsAt))
  const unavailable = (time: string) => occupied(time === '18:00' ? '17:30' : time) || isSlotElapsedForBangkokDate(time === '18:00' ? '17:30' : time, date)
  const selectSlot = (time: string) => {
    if (unavailable(time) || (time === '18:00' && !start)) return
    if (!start || end) { setStart(time); setEnd(null); return }
    if (time > start && isSelectableRange(start, time, SLOTS, unavailable)) setEnd(time)
    else { setStart(time); setEnd(null) }
  }
  const requestPath = `/meeting-room/${room.id}/request?date=${date}&start=${start ?? '08:00'}&end=${end ?? '09:00'}`
  const canRequest = room.active && Boolean(start && end)
  const roomTitle = meetingRoomDisplayName(room)

  return <section className="key-request-entry key-room-detail meeting-room-detail">
    <header className="key-detail-heading"><h1>{roomTitle}</h1><p>{room.description||'ยังไม่มีคำอธิบายห้อง'}</p><div className="key-detail-metadata"><span>{room.active ? 'เปิดใช้งาน' : 'ไม่พร้อมใช้'}</span><span>ต้องเข้าสู่ระบบ</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={room.imageUrl||defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทห้อง</small><strong>{room.roomTypeName}</strong></p><p><small>ความจุ</small><strong>{room.capacity > 0 ? `${room.capacity} ที่นั่ง` : 'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>{room.equipment?.length?room.equipment.join(' · '):'ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม'}</span></footer></article>
    <article className="key-detail-card key-history"><h2>รายการจองห้องประชุม</h2><time className="key-history-date">{thaiDate(date)}</time>{events.isPending ? <p className="key-detail-empty">กำลังโหลดรายการ…</p> : events.data?.length ? <ul>{events.data.map((item) => <li key={item.id}><span>{item.title}</span><time>{bangkokClock(item.startsAt)}–{bangkokClock(item.endsAt)} น.</time></li>)}</ul> : <p className="key-detail-empty">— ยังไม่มีรายการ —</p>}</article>
    <article className="key-detail-card key-schedule-card"><div className="key-schedule-heading"><h2>ตารางเวลาการใช้ห้อง</h2><time>{thaiDate(date)}</time><p>แตะครั้งแรกเพื่อเลือกเวลาเริ่มต้น แล้วแตะช่วงสุดท้ายที่ต้องการใช้งาน</p></div><div className="key-slot-legend"><span><i/>ว่าง</span><span><i/>จองแล้ว</span><span><i/>เลือกแล้ว</span></div><div className="key-slot-grid">{SLOTS.map((time) => { const blocked = unavailable(time); const selected = isTimeSelected(time, start, end); return <button key={time} type="button" aria-disabled={blocked} className={blocked ? 'unavailable' : selected ? 'selected' : ''} onClick={() => selectSlot(time)}><strong>{time}</strong><small>{blocked ? 'ไม่ว่าง' : time === start ? 'เลือก - เริ่ม' : time === end ? 'เลือก - จบ' : selected ? 'เลือก' : 'ว่าง'}</small></button> })}</div>{start && <div className="key-selected-time"><div className="key-time-summary"><span>เวลาเริ่มต้น<strong>{start}</strong></span><span>เวลาสิ้นสุด<strong>{end ?? 'กรุณาเลือก'}</strong></span></div><button type="button" className="key-reset-selection" onClick={() => { setStart(null); setEnd(null) }}>เลือกช่วงเวลาใหม่</button></div>}</article>
    {!identity ? <button className="primary-action" disabled={!canRequest} onClick={() => setLoginOpen(true)}>จองห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>จองห้องนี้</Link>}
    {loginOpen && <GoogleSsoModal returnTo={requestPath} onClose={() => setLoginOpen(false)} />}
  </section>
}
