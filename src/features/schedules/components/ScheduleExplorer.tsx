import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { publicRoomsQuery, publicScheduleEventsQuery, roomsQuery, scheduleEventsQuery } from '../schedule.queries'
import { addDays, dateKey, startOfSundayWeek, startOfWeek, weekRange } from '../schedule.utils'
import { WeeklySchedule } from './WeeklySchedule'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

export function ScheduleExplorer({ roomRequired = false, emptyGridWithoutRoom = false, fixedRoomId, publicAccess = false, rangeMode = 'rolling', hideToolbar = false, bookingWindow = false, limitPublicWeeks = false, onEmptyCellSelect, onEventSelect, onCellSelect }: { roomRequired?: boolean; emptyGridWithoutRoom?: boolean; fixedRoomId?: string; publicAccess?: boolean; rangeMode?: 'rolling' | 'calendar-week' | 'sunday-week'; hideToolbar?: boolean; bookingWindow?: boolean; limitPublicWeeks?: boolean; onEmptyCellSelect?: (date: string, time: string) => void; onEventSelect?: (event: import('../schedule.types').ScheduleEvent) => void; onCellSelect?: (selection: import('./WeeklySchedule').ScheduleCellSelection) => void }) {
  const [params, setParams] = useSearchParams()
  const [week, setWeek] = useState(() => { const today = new Date(); today.setHours(0, 0, 0, 0); return rangeMode === 'calendar-week' ? startOfWeek(today) : rangeMode === 'sunday-week' ? startOfSundayWeek(today) : today })
  const roomId = fixedRoomId ?? params.get('room') ?? ''
  const adminRooms = useQuery({ ...roomsQuery(), enabled: !publicAccess })
  const guestRooms = useQuery({ ...publicRoomsQuery(), enabled: publicAccess })
  const rooms = publicAccess ? guestRooms : adminRooms
  const filters = { roomId: roomId || undefined, ...weekRange(week) }
  const enabled = !roomRequired || Boolean(roomId)
  const adminEvents = useQuery({ ...scheduleEventsQuery(filters), enabled: enabled && !publicAccess })
  const guestEvents = useQuery({ ...publicScheduleEventsQuery(filters), enabled: enabled && publicAccess })
  const events = publicAccess ? guestEvents : adminEvents
  const currentPublicWeek = startOfSundayWeek(new Date())
  const previousDisabled = limitPublicWeeks && week <= currentPublicWeek
  const nextDisabled = limitPublicWeeks && week >= addDays(currentPublicWeek, 7)
  return <>
    {!hideToolbar && <div className="schedule-toolbar">{!fixedRoomId && <label>ห้อง<select value={roomId} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set('room', event.target.value); else next.delete('room'); setParams(next) }}><option value="">เลือกห้อง</option>{rooms.data?.filter((room) => room.active).map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label>}<div><button aria-label="7 วันก่อนหน้า" disabled={previousDisabled} onClick={() => setWeek(addDays(week, -7))}>‹</button><strong>{dateKey(week)} — {dateKey(addDays(week, 6))}</strong><button aria-label="7 วันถัดไป" disabled={nextDisabled} onClick={() => setWeek(addDays(week, 7))}>›</button></div></div>}
    {events.error && <p className="panel-error">{publicAccess ? 'ไม่สามารถโหลดตารางห้องได้ กรุณาลองใหม่อีกครั้ง' : events.error.message}</p>}
    {roomRequired && !roomId && !emptyGridWithoutRoom ? <div className="empty-panel">เลือกห้องเพื่อดูตารางเรียน การจอง และช่วงปิดห้อง</div> : events.isPending && roomId ? <LoadingSpinner label="กำลังโหลดตาราง…" /> : <WeeklySchedule rangeStart={week} events={roomId ? events.data ?? [] : []} bookingWindow={bookingWindow} onEmptyCellSelect={roomId ? onEmptyCellSelect : undefined} onEventSelect={onEventSelect} onCellSelect={roomId ? onCellSelect : undefined} />}
  </>
}
