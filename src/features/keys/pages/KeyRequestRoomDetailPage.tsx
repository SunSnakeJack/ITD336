import { hasViewerPermission, keyRequestPermission, useViewerPermissions } from '../../auth/viewer-permissions.queries'
import { keyCatalogPath } from '../utils/key-catalog-path'
import { thaiRoomType } from '../../rooms/utils/room-type-label'
import { SelectField } from '../../../shared/components/SelectField'
import { availableEndTimes, timeSelectOptions, isRoomSlotElapsed, roomSlotBounds, roomSlotTimes } from '../../schedules/request-time-options'
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
import { isSelectableRange, isTimeSelected } from '../utils/key-slot-selection'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { useTabDraft } from '../../../shared/components/useTabDraft'
import defaultRoomImage from '../../../assets/default-room.jpg'
import './KeyRequestRoomDetailPage.css'

const bangkokDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const thaiDate = (date:string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday:'long',year:'numeric',month:'long',day:'numeric' }).format(new Date(`${date}T00:00:00+07:00`))

export function KeyRequestRoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((candidate) => candidate.id === roomId)
  const access = useViewerPermissions(identity)
  const date = useMemo(bangkokDate, [])
  const events = useQuery(publicScheduleEventsQuery({ roomId, from: date, to: date }))
  const history = useQuery(publicKeyRequestHistoryQuery(roomId))
  const saturday = useQuery(saturdayPolicyQuery())
  const closed = isSaturdayClosed(date, saturday.data)
  const timingPolicy=useQuery(keyRequestTimingPolicyQuery())
  const [{ start, end }, updateSelection] = useTabDraft<{ start: string | null; end: string | null }>(
    `draft:key-selection:${identity?.userId ?? 'guest'}:${roomId}:${date}`, { start: null, end: null },
  )
  const [selectionId, setSelectionId] = useState(() => crypto.randomUUID())
  const [showLogin, setShowLogin] = useState(false)
  const [selectionNotice,setSelectionNotice]=useState<string|null>(null)

  useEffect(()=>{if(!selectionNotice)return;const timer=window.setTimeout(()=>setSelectionNotice(null),3000);return()=>window.clearTimeout(timer)},[selectionNotice])

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (rooms.isError) return <section className="key-request-entry" role="alert">ไม่สามารถโหลดข้อมูลห้องได้ <button type="button" onClick={() => void rooms.refetch()}>ลองใหม่</button></section>
  if (!room || room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />

  const now = new Date()
  const slots = roomSlotTimes(room.operatingHours)
  const closingTime = slots[slots.length - 1]
  const covers = (item: { startsAt: string; endsAt: string }, time: string) => {
    const [startsAt, endsAt] = roomSlotBounds(date, time, slots)
    return Date.parse(item.startsAt) < endsAt && Date.parse(item.endsAt) > startsAt
  }
  const occupied = (time: string) => events.data?.find(event => covers(event, time))
  const isUnavailable = (time: string) => {
    return closed || Boolean(occupied(time)) || isRoomSlotElapsed(date, time, slots, now, timingPolicy.data ?? false)
  }
  const hasNotElapsed = (time: string) => !isRoomSlotElapsed(date, time, slots, now)
  const startOptions = timeSelectOptions(slots.slice(0, -1).filter(hasNotElapsed), isUnavailable)
  const endOptions = timeSelectOptions(availableEndTimes(slots, start ?? '', isUnavailable).filter(hasNotElapsed))
  const selectedEnd = endOptions.find(option => option.value === end)?.value ?? null
  const changeStart = (time: string | null) => { updateSelection({ start: time, end: null }); setSelectionNotice(null) }
  const changeEnd = (time: string) => { updateSelection({ end: time }); setSelectionId(crypto.randomUUID()); setSelectionNotice(null) }
  const getSlot = (time: string): RoomScheduleSlot => {
    const disabled = isUnavailable(time)
    const event = occupied(time)
    const elapsed = isRoomSlotElapsed(date, time, slots, now)
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
    if (time === closingTime && (!start || end)) { setSelectionNotice(`เวลา ${closingTime} ใช้เป็นเวลาสิ้นสุดเท่านั้น`); return }
    if (start === time) { changeStart(null); return }
    if (!start || end) { changeStart(time); return }
    if (time > start) {
      if(isSelectableRange(start,time,slots,isUnavailable)) changeEnd(time)
      else setSelectionNotice('ไม่สามารถเลือกช่วงเวลานี้ได้ เนื่องจากมีรายการใช้งานห้องคั่นอยู่')
      return
    }
    changeStart(time)
  }
  const requestPath = `/keys/rooms/${room.id}/request?date=${date}&start=${start ?? slots[0]}&end=${selectedEnd ?? ''}&selection=${selectionId}`
  const permitted = hasViewerPermission(access.data, keyRequestPermission(room.requiresSsoForKeyRequest))
  const needsSignIn = !identity && (room.requiresLoginForKeyRequest || !permitted)
  const canRequest = access.isSuccess && !closed && room.active && Boolean(start && selectedEnd) && (!identity || permitted)
  const clearSelection = () => changeStart(null)

  return <section className="key-request-entry key-room-detail">
    <Link className="back-link" to={keyCatalogPath(room.requiresSsoForKeyRequest)}>← กลับ</Link>
    <header className="key-detail-heading"><h1>ห้อง {room.code}</h1><p>{room.description||'ยังไม่มีคำอธิบายห้อง'}</p><div className="key-detail-metadata"><span>{room.active?'เปิดใช้งาน':'ไม่พร้อมใช้'}</span><span>{room.requiresLoginForKeyRequest?'ต้องเข้าสู่ระบบ':'ไม่ต้องเข้าสู่ระบบ'}</span><span>{room.requiresSsoForKeyRequest?'รออนุมัติ':'ไม่ต้องรออนุมัติ'}</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={room.imageUrl||defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" loading="lazy" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทห้อง</small><strong>{thaiRoomType(room.roomTypeName)}</strong></p><p><small>ความจุ</small><strong>{room.capacity>0?`${room.capacity} ที่นั่ง`:'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>{room.equipment?.length?room.equipment.join(' · '):'ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม'}</span></footer></article>
    <article className="key-detail-card key-history"><h2>รายการผู้เบิกกุญแจ</h2>{history.isPending?<p className="key-detail-empty">กำลังโหลดรายการ…</p>:history.isError?<p className="key-detail-empty">ไม่สามารถโหลดรายการได้</p>:history.data?.length ? <RoomUsageHistory items={history.data.map(item => ({ ...item, title: item.requesterName }))} label="รายการผู้เบิกกุญแจทั้งหมด" heading="รายการเบิก" compact />:<p className="key-detail-empty">— ยังไม่มีรายการ —</p>}</article>
    <article className="key-detail-card key-schedule-card"><div className="key-schedule-heading" data-testid="key-schedule-heading"><h2>ตารางเวลาการเบิกกุญแจ</h2><time dateTime={date}>{thaiDate(date)}<span className="sr-only"> ({date})</span></time><p>เลือกเวลาเริ่มต้นจากตารางหรือดรอปดาวน์ แล้วปรับเวลาสิ้นสุดได้ตามต้องการ</p></div><RoomScheduleGrid times={slots} upcomingTimes={slots.filter(hasNotElapsed)} serviceEnded={now.getTime() >= Date.parse(`${date}T${room.operatingHours?.closesAt ?? closingTime}:00+07:00`)} hasSelectableStart={events.isSuccess && room.active && !closed ? startOptions.some(option => !option.disabled) : undefined} getSlot={getSlot} onSelect={selectSlot} />{selectionNotice&&<p className="key-selection-notice" role="alert">{selectionNotice}</p>}<div className="key-selected-time"><div className="key-time-summary"><SelectField label="เวลาเริ่มต้น" value={start ?? ''} placeholder="กรุณาเลือก" options={startOptions} disabled={!startOptions.some(option => !option.disabled)} onChange={changeStart}/><SelectField label="เวลาสิ้นสุด" value={selectedEnd ?? ''} placeholder={start ? "กรุณาเลือก" : "เลือกเวลาเริ่มต้นก่อน"} options={endOptions} disabled={!endOptions.length} onChange={changeEnd}/></div>{start && <button type="button" className="key-reset-selection" onClick={clearSelection}>เลือกช่วงเวลาใหม่</button>}</div></article>
    {identity && access.isSuccess && !permitted && <p role="status">บัญชีนี้ไม่มีสิทธิ์เบิกกุญแจห้องนี้</p>}
    {needsSignIn ? <button className="primary-action" disabled={!canRequest} onClick={() => setShowLogin(true)}>เบิกกุญแจห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>เบิกกุญแจห้องนี้</Link>}
    {showLogin && <GoogleSsoModal returnTo={requestPath} onClose={() => setShowLogin(false)} />}
  </section>
}
