import { DEFAULT_SLOT_MINUTES, roomSlotTimes } from '../../schedules/request-time-options'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { getMeetingWeek } from '../meeting-week.service'
import { clockMinutes, layoutMeetingDay, meetingEventCategories, meetingWeekStart, minuteLabel, shiftDate, type MeetingWeekEvent } from '../utils/meeting-week'
import { bangkokClock } from '../../keys/utils/key-catalog-time'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { MeetingEventDialog } from './MeetingEventDialog'
import './MeetingWeekSchedule.css'
import { readTabState, useTabDraft, writeTabState } from '../../../shared/components/useTabDraft'

const dateOptions = { timeZone: 'UTC' } as const
const weekLabel = new Intl.DateTimeFormat('th-TH', { ...dateOptions, day: 'numeric', month: 'short', year: 'numeric' })
const dayLabel = new Intl.DateTimeFormat('th-TH', { ...dateOptions, weekday: 'short', day: 'numeric', month: 'short' })
const asDate = (value: string) => new Date(`${value}T00:00:00Z`)

export function MeetingWeekSchedule({ roomId, roomName, today, viewerId, slotMinutes = DEFAULT_SLOT_MINUTES }: {
  roomId: string; roomName: string; today: string; viewerId: string | null; slotMinutes?: number
}) {
  const [{ offset }, update] = useTabDraft(`meeting-week:${viewerId ?? 'guest'}:${roomId}:${meetingWeekStart(today, 0)}`, { offset: 0 })
  const scrollKey = `meeting-week-scroll:${viewerId ?? 'guest'}:${roomId}`
  const [selectedEvent, setSelectedEvent] = useState<MeetingWeekEvent | null>(null)
  const tableArea = useRef<HTMLDivElement>(null)
  const [tableHeight, setTableHeight] = useState(0)
  const changeWeek = (next: number) => {
    setTableHeight(tableArea.current?.offsetHeight ?? 0)
    update({ offset: next })
  }
  const weekStart = meetingWeekStart(today, offset)
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index))
  const week = useQuery({
    queryKey: [...scheduleKeys.publicMeetingWeeks(), roomId, weekStart, viewerId],
    queryFn: () => getMeetingWeek(roomId, weekStart, viewerId),
    placeholderData: keepPreviousData,
  })
  const opens = week.data ? clockMinutes(week.data.opens_at) : NaN
  const closes = week.data ? clockMinutes(week.data.closes_at) : NaN
  const validHours = opens >= 0 && closes <= 24 * 60 && closes > opens
  const ticks = validHours ? [
    ...roomSlotTimes({ opensAt: minuteLabel(opens), closesAt: minuteLabel(closes), slotMinutes }).map(clockMinutes).filter(time => time < closes),
    closes,
  ] : []
  const position = (time: number) => `${(time - opens) / (closes - opens) * 100}%`

  return <div className="meeting-weekly">
    <ul className="meeting-week-legend" aria-label="ประเภทการใช้ห้อง">
      {(['LEADERSHIP', 'TEACHER'] as const).map(category => <li key={category} data-category={category}>{meetingEventCategories[category]}</li>)}
    </ul>
    <div className="meeting-week-navigation">
      <button type="button" aria-label="สัปดาห์ก่อนหน้า" disabled={offset <= -1} onClick={() => changeWeek(offset - 1)}>‹</button>
      <span aria-live="polite">{weekLabel.formatRange(asDate(weekStart), asDate(dates[6]))}</span>
      <button type="button" aria-label="สัปดาห์ถัดไป" disabled={offset >= 1} onClick={() => changeWeek(offset + 1)}>›</button>
    </div>
    <div ref={tableArea} className="meeting-week-table-area" style={{ minHeight: tableHeight }}>
    {week.isPending ? <p role="status">กำลังโหลดตารางรายสัปดาห์…</p>
      : week.isError || !validHours ? <p role="alert">ไม่สามารถโหลดตารางรายสัปดาห์ได้</p>
      : <div className="meeting-week-scroll" role="region" aria-label="ตารางห้องประชุมรายสัปดาห์ เลื่อนดูเวลาได้" tabIndex={0}
        aria-busy={week.isPlaceholderData}
        ref={node => { if (node) node.scrollLeft = readTabState<number>(scrollKey) ?? 0 }}
        onScroll={event => writeTabState(scrollKey, event.currentTarget.scrollLeft)}>
        <table className="meeting-week-table" aria-label="ตารางเวลารายสัปดาห์"
          style={{ minWidth: `${5.25 + (closes - opens) / slotMinutes * 5.75}rem` }}>
          <thead><tr><th scope="col">วัน / เวลา</th><th scope="col">
            <div className="meeting-week-hours">{ticks.filter(time => time % 60 === 0 || time === opens || time === closes)
              .map(time => <span key={time} style={{ left: position(time) }} data-edge={time === opens ? 'start' : time === closes ? 'end' : undefined}>{minuteLabel(time)}</span>)}</div>
          </th></tr></thead>
          <tbody>{dates.map(date => {
            const entries = week.isPlaceholderData ? [] : layoutMeetingDay(date, opens, closes, week.data.events)
            const lanes = Math.max(1, ...entries.map(item => item.row + 1))
            return <tr key={date}>
              <th scope="row"><time dateTime={date}>{dayLabel.format(asDate(date))}</time></th>
              <td><div className="meeting-week-track" style={{ minHeight: `${lanes * 2.1 + .4}rem` }}>
                {ticks.slice(1, -1).map(time => <span className="meeting-week-tick" aria-hidden="true" key={time} data-hour={time % 60 === 0} style={{ left: position(time) }} />)}
                {entries.map(({ event, row, left, width }, index) => {
                  const time = `${bangkokClock(event.starts_at)}–${bangkokClock(event.ends_at)}`
                  const title = `${time} ${meetingEventCategories[event.category]}`
                  return <button type="button" className="meeting-week-event" data-category={event.category} key={index}
                    title={title} aria-label={`${dayLabel.format(asDate(date))} ${title}`} aria-haspopup="dialog"
                    onClick={() => setSelectedEvent(event)}
                    style={{ left: `${left}%`, width: `${width}%`, top: `${.2 + row * 2.1}rem` }}>{time}</button>
                })}
              </div></td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </div>
    {selectedEvent && <MeetingEventDialog event={selectedEvent} roomName={roomName} onClose={() => setSelectedEvent(null)} />}
  </div>
}
