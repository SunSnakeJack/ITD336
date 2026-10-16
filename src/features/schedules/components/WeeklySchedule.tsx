import { useState } from 'react'
import type { ScheduleEvent } from '../schedule.types'
import { addDays, dateKey, isWithinCalendarBookingWindow } from '../schedule.utils'

export const SCHEDULE_TIMES = Array.from({ length: 10 }, (_, index) => `${String(8 + index).padStart(2, '0')}:30`)
const EVENT_LABELS = { CLASS: 'Class', BOOKING: 'Booked', BLOCK: 'Blocked' }

function eventForSlot(events: ScheduleEvent[], day: Date, time: string) {
  const start = new Date(`${dateKey(day)}T${time}:00+07:00`).getTime()
  const end = start + 60 * 60 * 1000
  return events.find((event) => new Date(event.startsAt).getTime() < end && new Date(event.endsAt).getTime() > start)
}

export interface ScheduleCellSelection { date: string; time: string; event?: ScheduleEvent; holiday: boolean }

export function WeeklySchedule({ rangeStart, events, bookingWindow = false, onEmptyCellSelect, onEventSelect, onCellSelect }: { rangeStart: Date; events: ScheduleEvent[]; bookingWindow?: boolean; onEmptyCellSelect?: (date: string, time: string) => void; onEventSelect?: (event: ScheduleEvent) => void; onCellSelect?: (selection: ScheduleCellSelection) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const days = Array.from({ length: 7 }, (_, index) => addDays(rangeStart, index))
  return <div className="availability-table-wrap"><table className="availability-table"><thead><tr><th>Time</th>{days.map((day) => <th className={day.getDay() === 6 ? 'holiday-heading' : ''} key={dateKey(day)}>{new Intl.DateTimeFormat('th-TH', { weekday: 'short' }).format(day)} {day.getDate()}</th>)}</tr></thead><tbody>{SCHEDULE_TIMES.map((time) => <tr key={time}><th>{time}</th>{days.map((day) => {
    const cellKey = `${dateKey(day)}-${time}`
    const event = eventForSlot(events, day, time)
    const holiday = day.getDay() === 6
    const slotStart = new Date(`${dateKey(day)}T${time}:00+07:00`)
    const outsideBookingWindow = bookingWindow && !isWithinCalendarBookingWindow(slotStart)
    const unavailable = bookingWindow && (outsideBookingWindow || holiday)
    const interactive = Boolean(onEmptyCellSelect && !event && !holiday && !outsideBookingWindow)
    return <td key={cellKey}><button aria-pressed={selected === cellKey} className={`${outsideBookingWindow ? 'booking-unavailable' : holiday ? 'holiday' : event ? `occupied event-${event.eventType.toLowerCase()}${event.isMine ? ' event-mine' : ''}` : 'available'}${selected === cellKey ? ' selected' : ''}`} disabled={unavailable || (holiday && !onCellSelect)} onClick={() => { setSelected(cellKey); if (onCellSelect) onCellSelect({ date: dateKey(day), time, event, holiday }); else if (interactive) onEmptyCellSelect?.(dateKey(day), time); else if (event && (event.eventType === 'CLASS' || event.eventType === 'BOOKING')) onEventSelect?.(event) }} title={outsideBookingWindow ? 'อยู่นอกช่วงเวลาที่เปิดให้จอง' : holiday ? 'วันหยุดประจำสัปดาห์' : event?.title ?? `ว่าง ${cellKey}`}><span>{holiday ? 'วันหยุด' : event ? EVENT_LABELS[event.eventType] : ''}</span>{event && !holiday && <small>{event.title}</small>}</button></td>
  })}</tr>)}</tbody></table></div>
}
