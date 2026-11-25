import { hasViewerPermission, useViewerPermissions } from '../../auth/viewer-permissions.queries'
import { thaiRoomType } from '../../rooms/utils/room-type-label'
import { SelectField } from '../../../shared/components/SelectField'
import { availableEndTimes, timeSelectOptions, isRoomSlotElapsed, isRoomSlotOccupied, roomSlotTimes } from '../../schedules/request-time-options'
import { useQuery } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { GoogleSsoModal } from '../../auth/components/GoogleSsoModal'
import { publicRoomsQuery, publicScheduleEventsQuery } from '../../schedules/schedule.queries'
import { RoomScheduleGrid, type RoomScheduleSlot } from '../../schedules/components/RoomScheduleGrid'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { isSelectableRange, isTimeSelected } from '../../keys/utils/key-slot-selection'
import defaultRoomImage from '../../../assets/default-room.jpg'
import '../../keys/pages/KeyRequestRoomDetailPage.css'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'
import { MeetingWeekSchedule } from '../components/MeetingWeekSchedule'
import { MeetingBookingList } from '../components/MeetingBookingList'
import { getMeetingWeek } from '../meeting-week.service'
import { meetingWeekStart } from '../utils/meeting-week'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { canOverrideMeetingEvent } from '../utils/meeting-time-options'
import { useTabDraft } from '../../../shared/components/useTabDraft'
import { meetingDetailSelectionKey, type MeetingDetailSelection } from '../utils/meeting-detail-selection'
import { useMergedRoomCatalog } from '../../public/useMergedRoomCatalog'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
const thaiDate = (date: string) => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${date}T00:00:00+07:00`))

export function MeetingRoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const { state } = useLocation()
  const mergedCatalog = useMergedRoomCatalog()
  const catalogBack = mergedCatalog && state?.fromRoomCatalog === true ? '/keys?section=meeting' : '/meeting-room'
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const date = useMemo(today, [])
  const access = useViewerPermissions(identity)
  const canBook = hasViewerPermission(access.data, 'MEETING_BOOK')
  const canOverride = canBook && hasViewerPermission(access.data, 'BOOKING_OVERRIDE')
  const events = useQuery(publicScheduleEventsQuery({ roomId, from: date, to: date }))
  const [selection, updateSelection] = useTabDraft<MeetingDetailSelection>(
    meetingDetailSelectionKey(identity?.userId ?? 'guest', roomId, date),
    { start: null, end: null, scheduleView: 'daily' },
  )
  const { end, scheduleView } = selection
  const setStart = (value: string | null) => updateSelection({ start: value })
  const setEnd = (value: string | null) => updateSelection({ end: value })
  const [loginOpen, setLoginOpen] = useState(false)
  const setScheduleView = (value: 'daily' | 'weekly') => updateSelection({ scheduleView: value })
  const viewerId = identity?.userId ?? null
  const weekStart = meetingWeekStart(date, 0)
  const meetingWeek = useQuery({
    queryKey: [...scheduleKeys.publicMeetingWeeks(), roomId, weekStart, viewerId],
    queryFn: () => getMeetingWeek(roomId, weekStart, viewerId),
    enabled: Boolean(room && viewerId && scheduleView === 'daily'),
  })
  const scheduleId = useId()

  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้องประชุม…" />
  if (!room || room.usageScope !== 'MEETING') return <Navigate to="/meeting-room" replace />

  const times = roomSlotTimes(room.operatingHours)
  const closingBoundary = times.at(-1)
  const now = new Date()
  const hasNotElapsed = (time: string) => !isRoomSlotElapsed(date, time, times, now)
  const occupied = (time: string) => {
    const overlapping = events.data?.filter(event => isRoomSlotOccupied(date, time, times, [event])) ?? []
    return overlapping.find(event => !canOverrideMeetingEvent(canOverride, event, new Date())) ?? overlapping[0]
  }
  const canSelectOccupied = (event: ReturnType<typeof occupied>) =>
    Boolean(event && canOverrideMeetingEvent(canOverride, event, new Date()))
  const unavailable = (time: string) => {
    const event = occupied(time)
    return Boolean(event && !canSelectOccupied(event)) || !hasNotElapsed(time)
  }
  const startOptions = timeSelectOptions(times.slice(0, -1).filter(hasNotElapsed), unavailable)
  const start = startOptions.find(option => option.value === selection.start && !option.disabled)?.value ?? null
  const endOptions = timeSelectOptions(availableEndTimes(times, start ?? '', unavailable).filter(hasNotElapsed))
  const selectedEnd = endOptions.find(option => option.value === end)?.value ?? null
  const changeStart = (time: string) => { setStart(time); setEnd(null) }
  const getSlot = (time: string): RoomScheduleSlot => {
    const event = occupied(time)
    if (event?.eventType === 'BLOCK') return { state: 'closed', label: 'ปิดให้บริการ', disabled: true }

    const requesterName = event?.eventType === 'BOOKING' ? meetingWeek.data?.events.find(item =>
      item.requester_name && Date.parse(item.starts_at) === Date.parse(event.startsAt)
        && Date.parse(item.ends_at) === Date.parse(event.endsAt),
    )?.requester_name : undefined
    const bookingLabel = requesterName?.trim() || 'จองแล้ว'
    if (!hasNotElapsed(time)) {
      return { state: 'elapsed', label: event ? bookingLabel : 'ผ่านแล้ว', disabled: true }
    }
    if (isTimeSelected(time, start, selectedEnd)) {
      return { state: 'selected', label: time === start ? 'เลือก - เริ่ม' : time === selectedEnd ? 'เลือก - จบ' : 'เลือก', disabled: false }
    }
    if (event) return {
      state: 'occupied', label: bookingLabel,
      disabled: !canSelectOccupied(event),
    }
    return { state: 'free', label: 'ว่าง', disabled: false }
  }
  const selectSlot = (time: string) => {
    if (unavailable(time) || (time === closingBoundary && (!start || end))) return
    if (!start || end) { setStart(time); setEnd(null); return }
    if (time > start && isSelectableRange(start, time, times, unavailable)) setEnd(time)
    else { setStart(time); setEnd(null) }
  }
  const requestPath = `/meeting-room/${room.id}/request?date=${date}&start=${start ?? times[0] ?? ''}&end=${selectedEnd ?? ''}`
  const canRequest = (!identity || canBook) && room.active && Boolean(start && selectedEnd)
  const roomTitle = meetingRoomDisplayName(room)

  return <section className="key-request-entry key-room-detail meeting-room-detail">
    <Link className="back-link" to={catalogBack}><span aria-hidden="true">&lt;</span>{' '}กลับไปเลือกห้อง</Link>
    <header className="key-detail-heading"><h1>{roomTitle}</h1><p>{room.description||'ยังไม่มีคำอธิบายห้อง'}</p><div className="key-detail-metadata"><span>{room.active ? 'เปิดใช้งาน' : 'ไม่พร้อมใช้'}</span><span>ต้องเข้าสู่ระบบ</span></div></header>
    <article className="key-detail-card key-room-information"><div className="key-room-photo"><img src={room.imageUrl||defaultRoomImage} alt={`ภาพห้อง ${room.code}`} className="key-room-photo-image" /></div><div className="key-room-facts"><h2>ข้อมูลห้อง</h2><p><small>ประเภทห้อง</small><strong>{thaiRoomType(room.roomTypeName)}</strong></p><p><small>ความจุ</small><strong>{room.capacity > 0 ? `${room.capacity} ที่นั่ง` : 'ยังไม่มีข้อมูล'}</strong></p></div><footer><strong>อุปกรณ์เพิ่มเติม</strong><span>{room.equipment?.length?room.equipment.join(' · '):'ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม'}</span></footer></article>
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
          roomName={roomTitle} today={date} viewerId={identity?.userId ?? null} slotMinutes={room.operatingHours?.slotMinutes} /> : <>
          <div className="key-schedule-heading"><time>{thaiDate(date)}</time><p>เลือกเวลาเริ่มต้นจากตารางหรือดรอปดาวน์ แล้วปรับเวลาสิ้นสุดได้ตามต้องการ</p></div>
          <RoomScheduleGrid times={times} upcomingTimes={times.filter(hasNotElapsed)} serviceEnded={now.getTime() >= Date.parse(`${date}T${room.operatingHours?.closesAt ?? closingBoundary}:00+07:00`)} hasSelectableStart={events.isSuccess && room.active ? startOptions.some(option => !option.disabled) : undefined} getSlot={getSlot} onSelect={selectSlot} occupiedLabel="จองแล้ว" />
          <div className="key-selected-time"><div className="key-time-summary"><SelectField label="เวลาเริ่มต้น" value={start ?? ''} placeholder="กรุณาเลือก" options={startOptions} disabled={!startOptions.some(option => !option.disabled)} onChange={changeStart}/><SelectField label="เวลาสิ้นสุด" value={selectedEnd ?? ''} placeholder={start ? "กรุณาเลือก" : "เลือกเวลาเริ่มต้นก่อน"} options={endOptions} disabled={!endOptions.length} onChange={setEnd}/></div>{start && <button type="button" className="key-reset-selection" onClick={() => { setStart(null); setEnd(null) }}>เลือกช่วงเวลาใหม่</button>}</div>
        </>}
      </div>
    </article>
    {scheduleView === 'daily' && (!identity ? <button className="primary-action" disabled={!canRequest} onClick={() => setLoginOpen(true)}>จองห้องนี้</button> : <Link className="primary-action" aria-disabled={!canRequest} to={canRequest ? requestPath : '#'}>จองห้องนี้</Link>)}
    {loginOpen && <GoogleSsoModal returnTo={requestPath} onClose={() => setLoginOpen(false)} />}
  </section>
}
