import { keyCatalogPath } from '../utils/key-catalog-path'
import { thaiRoomType } from '../../rooms/utils/room-type-label'
import { SelectField } from '../../../shared/components/SelectField'
import { availableEndTimes, timeSelectOptions } from '../../schedules/request-time-options'
import { isSaturdayClosed } from '../../schedules/saturday-policy'
import { saturdayPolicyQuery } from '../../schedules/saturday-policy.queries'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { RoomUsageHistory } from '../../schedules/components/RoomUsageHistory'
import { RoomScheduleGrid, type RoomScheduleSlot } from '../../schedules/components/RoomScheduleGrid'
import { keyRequestTimingPolicyQuery, publicKeyRequestHistoryQuery } from '../key.queries'
import { isSlotElapsedForBangkokDate } from '../utils/key-catalog-time'
import { isSelectableRange, isTimeSelected } from '../utils/key-slot-selection'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import defaultRoomImage from '../../../assets/default-room.jpg'
import './KeyRequestRoomDetailPage.css'

const SLOTS = Array.from({ length: 21 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)
const bangkokDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const thaiDate = (date:string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday:'long',year:'numeric',month:'long',day:'numeric' }).format(new Date(`${date}T00:00:00+07:00`))

export function KeyRequestRoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((candidate) => candidate.id === roomId)
  const date = useMemo(bangkokDate, [])
  const events = useQuery(publicScheduleEventsQuery({ roomId, from: date, to: date }))
  const history = useQuery(publicKeyRequestHistoryQuery(roomId))
  const saturday = useQuery(saturdayPolicyQuery())
  const closed = isSaturdayClosed(date, saturday.data)
  const timingPolicy=useQuery(keyRequestTimingPolicyQuery())
  const [start, setStart] = useState<string | null>(null)
  const [end, setEnd] = useState<string | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [selectionNotice,setSelectionNotice]=useState<string|null>(null)

  useEffect(()=>{if(!selectionNotice)return;const timer=window.setTimeout(()=>setSelectionNotice(null),3000);return()=>window.clearTimeout(timer)},[selectionNotice])

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (!room || room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />

  const now = new Date()
  const slotTarget = (time: string) => time === '18:00' ? '17:30' : time
  const covers = (item: { startsAt: string; endsAt: string }, time: string) => {
    const startsAt = Date.parse(`${date}T${slotTarget(time)}:00+07:00`)
    return Date.parse(item.startsAt) < startsAt + 30 * 60_000 && Date.parse(item.endsAt) > startsAt
  }
  const occupied = (time: string) => events.data?.find(event => covers(event, time))
  const isUnavailable = (time: string) => {
    return closed || Boolean(occupied(time)) || isSlotElapsedForBangkokDate(time, date, now, timingPolicy.data ?? false)
  }
  const startOptions = timeSelectOptions(SLOTS.slice(0, -1), isUnavailable)
  const endOptions = timeSelectOptions(availableEndTimes(SLOTS, start ?? '', isUnavailable))
  const selectedEnd = endOptions.find(option => option.value === end)?.value ?? null
  const changeStart = (time: string) => { setStart(time); setEnd(null); setSelectionNotice(null) }
  const getSlot = (time: string): RoomScheduleSlot => {
    const disabled = isUnavailable(time)
    const event = occupied(time)
    const elapsed = isSlotElapsedForBangkokDate(time, date, now)
    const returned = elapsed && events.isSuccess
      ? history.data?.find(item => item.status === 'RETURNED' && covers(item, time)) : undefined

    if (closed) return { state: 'closed', label: 'ปิดให้บริการ', disabled }
    if (!disabled && isTimeSelected(time, start, selectedEnd)) {
      const label = time === start ? 'เลือก - เริ่ม' : time === selectedEnd ? 'เลือก - จบ' : 'เลือก'
      return { state: 'selected', label, disabled }
    }
    if (event?.eventType === 'BLOCK') return { state: 'closed', label: 'ปิดให้บริการ', disabled }
    if (event || returned) {
      const publicTitle = returned?.requesterName ?? (event?.id.startsWith('key-request:') ? event.title : '')
      return { state: elapsed ? 'elapsed' : 'occupied', label: publicTitle.split(' · ')[0].trim() || 'มีผู้ใช้', disabled }
    }
    if (elapsed) return { state: 'elapsed', label: 'ผ่านแล้ว', disabled }
    return { state: 'free', label: 'ว่าง', disabled }
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
  const requestPath = `/keys/rooms/${room.id}/request?date=${date}&start=${start ?? '08:00'}&end=${selectedEnd ?? ''}`
  const canRequest = !closed && room.active && Boolean(start && selectedEnd)
  const clearSelection=()=>{setStart(null);setEnd(null);setSelectionNotice(null)}

  return <section className="key-request-entry key-room-detail">
    <Link className="back-link" to={keyCatalogPath(room.requiresSsoForKeyRequest)}>← กลับ</Link>
    <header className="key-detail-heading"><h1>ห้อง {room.code}</h1><p>{room.description||'ยังไม่มีคำอธิบายห้อง'}</p><div className="key-detail-metadata"><span>{room.active?'เปิดใช้งาน':'ไม่พร้อมใช้'}</span><span>{room.requiresSsoForKeyRequest?'ต้องเข้าสู่ระบบ':'ไม่ต้องเข้าสู่ระบบ'}</span><span>{room.requiresSsoForKeyRequest?'รออนุมัติ':'ไม่ต้องรออนุมัติ'}</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={room.imageUrl||defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" loading="lazy" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทห้อง</small><strong>{thaiRoomType(room.roomTypeName)}</strong></p><p><small>ความจุ</small><strong>{room.capacity>0?`${room.capacity} ที่นั่ง`:'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>{room.equipment?.length?room.equipment.join(' · '):'ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม'}</span></footer></article>
    <article className="key-detail-card key-history"><h2>รายการผู้เบิกกุญแจ</h2>{history.isPending?<p className="key-detail-empty">กำลังโหลดรายการ…</p>:history.isError?<p className="key-detail-empty">ไม่สามารถโหลดรายการได้</p>:history.data?.length ? <RoomUsageHistory items={history.data.map(item => ({ ...item, title: item.requesterName }))} label="รายการผู้เบิกกุญแจทั้งหมด" heading="รายการเบิก" compact />:<p className="key-detail-empty">— ยังไม่มีรายการ —</p>}</article>
    <article className="key-detail-card key-schedule-card"><div className="key-schedule-heading" data-testid="key-schedule-heading"><h2>ตารางเวลาการเบิกกุญแจ</h2><time dateTime={date}>{thaiDate(date)}<span className="sr-only"> ({date})</span></time><p>เลือกเวลาเริ่มต้นจากตารางหรือดรอปดาวน์ แล้วปรับเวลาสิ้นสุดได้ตามต้องการ</p></div><RoomScheduleGrid times={SLOTS} getSlot={getSlot} onSelect={selectSlot} />{selectionNotice&&<p className="key-selection-notice" role="alert">{selectionNotice}</p>}<div className="key-selected-time"><div className="key-time-summary"><SelectField label="เวลาเริ่มต้น" value={start ?? ''} placeholder="กรุณาเลือก" options={startOptions} disabled={!startOptions.some(option => !option.disabled)} onChange={changeStart}/><SelectField label="เวลาสิ้นสุด" value={selectedEnd ?? ''} placeholder="กรุณาเลือก" options={endOptions} disabled={!endOptions.length} onChange={setEnd}/></div>{start && <button type="button" className="key-reset-selection" onClick={clearSelection}>เลือกช่วงเวลาใหม่</button>}</div></article>
    {room.requiresSsoForKeyRequest && !identity ? <button className="primary-action" disabled={!canRequest} onClick={() => setShowLogin(true)}>เบิกกุญแจห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>เบิกกุญแจห้องนี้</Link>}
    {showLogin && <GoogleSsoModal returnTo={requestPath} onClose={() => setShowLogin(false)} />}
  </section>
}
