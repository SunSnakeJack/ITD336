import { SelectField } from '../../../shared/components/SelectField'
import { availableEndTimes, isHalfHourOccupied, timeSelectOptions } from '../../schedules/request-time-options'
import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { RoomScheduleGrid, type RoomScheduleSlot } from '../../schedules/components/RoomScheduleGrid'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { isSlotElapsedForBangkokDate } from '../../keys/utils/key-catalog-time'
import { isSelectableRange, isTimeSelected } from '../../keys/utils/key-slot-selection'
import defaultRoomImage from '../../../assets/default-room.jpg'
import '../../keys/pages/KeyRequestRoomDetailPage.css'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'
import { MeetingWeekSchedule } from '../components/MeetingWeekSchedule'
import { MeetingBookingList } from '../components/MeetingBookingList'
import { canOverrideMeetingEvent, MEETING_TIMES } from '../utils/meeting-time-options'

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
  const [scheduleView, setScheduleView] = useState<'daily' | 'weekly'>('daily')
  const scheduleId = useId()

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้องประชุม…" />
  if (!room || room.usageScope !== 'MEETING') return <Navigate to="/meeting-room" replace />

  const occupied = (time: string) => {
    const target = time === '18:00' ? '17:30' : time
    const overlapping = events.data?.filter((event) => isHalfHourOccupied(date, target, [event])) ?? []
    return overlapping.find(event => !canOverrideMeetingEvent(identity?.role, event, new Date())) ?? overlapping[0]
  }
  const canSelectOccupied = (event: ReturnType<typeof occupied>) =>
    Boolean(event && canOverrideMeetingEvent(identity?.role, event, new Date()))
  const unavailable = (time: string) => {
    const event = occupied(time)
    return Boolean(event && !canSelectOccupied(event)) || isSlotElapsedForBangkokDate(time, date)
  }
  const startOptions = timeSelectOptions(MEETING_TIMES.slice(0, -1), unavailable)
  const endOptions = timeSelectOptions(availableEndTimes(MEETING_TIMES, start ?? '', unavailable))
  const selectedEnd = endOptions.find(option => option.value === end)?.value ?? null
  const changeStart = (time: string) => { setStart(time); setEnd(null) }
  const getSlot = (time: string): RoomScheduleSlot => {
    const event = occupied(time)
    if (event?.eventType === 'BLOCK') return { state: 'closed', label: 'ปิดให้บริการ', disabled: true }

    if (isSlotElapsedForBangkokDate(time, date)) return { state: 'elapsed', label: 'ผ่านแล้ว', disabled: true }
    if (isTimeSelected(time, start, selectedEnd)) {
      return { state: 'selected', label: time === start ? 'เลือก - เริ่ม' : time === selectedEnd ? 'เลือก - จบ' : 'เลือก', disabled: false }
    }
    if (event) return {
      state: 'occupied', label: canSelectOccupied(event) ? 'จองแล้ว · เลือกเพื่อตรวจสอบสิทธิ์จองทับ' : 'จองแล้ว',
      disabled: !canSelectOccupied(event),
    }
    return { state: 'free', label: 'ว่าง', disabled: false }
  }
  const selectSlot = (time: string) => {
    if (unavailable(time) || (time === '18:00' && (!start || end))) return
    if (!start || end) { setStart(time); setEnd(null); return }
    if (time > start && isSelectableRange(start, time, MEETING_TIMES, unavailable)) setEnd(time)
    else { setStart(time); setEnd(null) }
  }
  const requestPath = `/meeting-room/${room.id}/request?date=${date}&start=${start ?? '08:00'}&end=${selectedEnd ?? ''}`
  const canRequest = room.active && Boolean(start && selectedEnd)
  const roomTitle = meetingRoomDisplayName(room)

  return <section className="key-request-entry key-room-detail meeting-room-detail">
    <header className="key-detail-heading"><h1>{roomTitle}</h1><p>{room.description||'ยังไม่มีคำอธิบายห้อง'}</p><div className="key-detail-metadata"><span>{room.active ? 'เปิดใช้งาน' : 'ไม่พร้อมใช้'}</span><span>ต้องเข้าสู่ระบบ</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={room.imageUrl||defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทห้อง</small><strong>{room.roomTypeName}</strong></p><p><small>ความจุ</small><strong>{room.capacity > 0 ? `${room.capacity} ที่นั่ง` : 'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>{room.equipment?.length?room.equipment.join(' · '):'ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม'}</span></footer></article>
    <MeetingBookingList key={room.id} roomId={room.id} active={room.active} viewerId={identity?.userId ?? null} />
    <article className="key-detail-card key-schedule-card">
      <div className="key-schedule-heading"><h2>ตารางเวลาการใช้ห้อง</h2></div>
      <div role="tablist" className="meeting-schedule-tabs" aria-label="มุมมองตารางเวลา"
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'daily' : event.key === 'End' ? 'weekly' : scheduleView === 'daily' ? 'weekly' : 'daily'
          setScheduleView(next)
          event.currentTarget.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus()
        }}>
        {(['daily', 'weekly'] as const).map(view => <button type="button" key={view} role="tab"
          id={`${scheduleId}-${view}`} data-view={view} aria-selected={scheduleView === view}
          aria-controls={`${scheduleId}-panel`} tabIndex={scheduleView === view ? 0 : -1}
          onClick={() => setScheduleView(view)}>{view === 'daily' ? 'รายวัน' : 'รายสัปดาห์'}</button>)}
      </div>
      <div id={`${scheduleId}-panel`} role="tabpanel" aria-labelledby={`${scheduleId}-${scheduleView}`}>
        {scheduleView === 'weekly' ? <MeetingWeekSchedule key={identity?.userId ?? 'guest'} roomId={room.id}
          roomName={roomTitle} today={date} viewerId={identity?.userId ?? null} /> : <>
          <div className="key-schedule-heading"><time>{thaiDate(date)}</time><p>เลือกเวลาเริ่มต้นจากตารางหรือดรอปดาวน์ แล้วปรับเวลาสิ้นสุดได้ตามต้องการ</p></div>
          <RoomScheduleGrid times={MEETING_TIMES} getSlot={getSlot} onSelect={selectSlot} occupiedLabel="จองแล้ว" />
          <div className="key-selected-time"><div className="key-time-summary"><SelectField label="เวลาเริ่มต้น" value={start ?? ''} placeholder="กรุณาเลือก" options={startOptions} disabled={!startOptions.some(option => !option.disabled)} onChange={changeStart}/><SelectField label="เวลาสิ้นสุด" value={selectedEnd ?? ''} placeholder="กรุณาเลือก" options={endOptions} disabled={!endOptions.length} onChange={setEnd}/></div>{start && <button type="button" className="key-reset-selection" onClick={() => { setStart(null); setEnd(null) }}>เลือกช่วงเวลาใหม่</button>}</div>
        </>}
      </div>
    </article>
    {scheduleView === 'daily' && (!identity ? <button className="primary-action" disabled={!canRequest} onClick={() => setLoginOpen(true)}>จองห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>จองห้องนี้</Link>)}
    {loginOpen && <GoogleSsoModal returnTo={requestPath} onClose={() => setLoginOpen(false)} />}
  </section>
}
