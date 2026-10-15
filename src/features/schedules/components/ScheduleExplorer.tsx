import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { publicRoomsQuery, publicScheduleEventsQuery, roomsQuery, scheduleEventsQuery } from '../schedule.queries'
import { addDays, dateKey, startOfWeek, weekRange } from '../schedule.utils'
import { WeeklySchedule } from './WeeklySchedule'

export function ScheduleExplorer({ roomRequired = false, fixedRoomId, publicAccess = false, rangeMode = 'rolling', hideToolbar = false, onEmptyCellSelect, onEventSelect, onCellSelect }: { roomRequired?: boolean; fixedRoomId?: string; publicAccess?: boolean; rangeMode?: 'rolling' | 'calendar-week'; hideToolbar?: boolean; onEmptyCellSelect?: (date: string, time: string) => void; onEventSelect?: (event: import('../schedule.types').ScheduleEvent) => void; onCellSelect?: (selection: import('./WeeklySchedule').ScheduleCellSelection) => void }) {
  const [params, setParams] = useSearchParams()
  const [week, setWeek] = useState(() => { const today = new Date(); today.setHours(0, 0, 0, 0); return rangeMode === 'calendar-week' ? startOfWeek(today) : today })
  const roomId = fixedRoomId ?? params.get('room') ?? ''
  const adminRooms = useQuery({ ...roomsQuery(), enabled: !publicAccess })
  const guestRooms = useQuery({ ...publicRoomsQuery(), enabled: publicAccess })
  const rooms = publicAccess ? guestRooms : adminRooms
  const filters = { roomId: roomId || undefined, ...weekRange(week) }
  const enabled = !roomRequired || Boolean(roomId)
  const adminEvents = useQuery({ ...scheduleEventsQuery(filters), enabled: enabled && !publicAccess })
  const guestEvents = useQuery({ ...publicScheduleEventsQuery(filters), enabled: enabled && publicAccess })
  const events = publicAccess ? guestEvents : adminEvents
  return <>
    {!hideToolbar && <div className="schedule-toolbar">{!fixedRoomId && <label>ห้อง<select value={roomId} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set('room', event.target.value); else next.delete('room'); setParams(next) }}><option value="">เลือกห้อง</option>{rooms.data?.filter((room) => room.active).map((room) => <option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label>}<div><button aria-label="7 วันก่อนหน้า" onClick={() => setWeek(addDays(week, -7))}>‹</button><strong>{dateKey(week)} — {dateKey(addDays(week, 6))}</strong><button aria-label="7 วันถัดไป" onClick={() => setWeek(addDays(week, 7))}>›</button><button onClick={() => { const today = new Date(); today.setHours(0, 0, 0, 0); setWeek(rangeMode === 'calendar-week' ? startOfWeek(today) : today) }}>วันนี้</button></div></div>}
    {events.error && <p className="panel-error">{publicAccess ? 'ไม่สามารถโหลดตารางห้องได้ กรุณาลองใหม่อีกครั้ง' : events.error.message}</p>}
    {roomRequired && !roomId ? <div className="empty-panel">เลือกห้องเพื่อดูตารางเรียน การจอง และช่วงปิดห้อง</div> : events.isPending ? <div className="empty-panel">กำลังโหลดตาราง…</div> : <WeeklySchedule rangeStart={week} events={events.data ?? []} onEmptyCellSelect={onEmptyCellSelect} onEventSelect={onEventSelect} onCellSelect={onCellSelect} />}
  </>
}
