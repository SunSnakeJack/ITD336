import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { RoomUsageHistory } from '../../schedules/components/RoomUsageHistory'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { getMeetingBookings, type MeetingBookingPeriod } from '../meeting-week.service'
import { meetingEventCategories } from '../utils/meeting-week'
import { useTabDraft } from '../../../shared/components/useTabDraft'

const tabs = { upcoming: 'จองล่วงหน้า', history: 'ประวัติการจอง' } as const

export function MeetingBookingList({ roomId, active, viewerId }: { roomId: string; active: boolean; viewerId: string | null }) {
  const id = useId()
  const [{ period }, update] = useTabDraft<{ period: MeetingBookingPeriod }>(
    `meeting-bookings:${viewerId ?? 'guest'}:${roomId}`, { period: 'upcoming' },
  )
  const setPeriod = (value: MeetingBookingPeriod) => update({ period: value })
  const bookings = useQuery({
    queryKey: [...scheduleKeys.publicMeetingBookings(roomId), period, viewerId],
    queryFn: () => getMeetingBookings(roomId, period, viewerId),
    enabled: active,
  })
  const upcoming = period === 'upcoming'
  const suffix = upcoming ? 'ล่วงหน้า' : 'ย้อนหลัง'
  const items = (bookings.data ?? []).slice(0, 5).map((item, index) => ({
    id: `${item.starts_at}-${index}`,
    title: [
      item.pending ? 'รออนุมัติ' : '',
      item.requester_name?.trim()
        ? `${item.category === 'TEACHER' ? 'อ. ' : ''}${item.requester_name.trim()}`
        : meetingEventCategories[item.category],
      item.purpose?.trim(),
    ].filter(Boolean).join(' · '),
    startsAt: item.starts_at,
    endsAt: item.ends_at,
  }))

  return <article className="key-detail-card key-history">
    <h2>รายการจองห้องประชุม</h2>
    <div role="tablist" className="meeting-schedule-tabs" aria-label="ช่วงเวลาของรายการจอง"
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? 'upcoming' : event.key === 'End' ? 'history' : upcoming ? 'history' : 'upcoming'
        setPeriod(next)
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-period="${next}"]`)?.focus()
      }}>
      {(['upcoming', 'history'] as const).map(tab => <button key={tab} type="button" role="tab"
        id={`${id}-${tab}`} data-period={tab} aria-selected={period === tab} aria-controls={`${id}-panel`}
        tabIndex={period === tab ? 0 : -1} onClick={() => setPeriod(tab)}>{tabs[tab]}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${period}`}>
      {bookings.isLoading ? <p className="key-detail-empty" role="status">กำลังโหลดรายการ…</p>
        : bookings.isError ? <p className="key-detail-empty" role="alert">ไม่สามารถโหลดรายการจอง{suffix}ได้</p>
        : items.length ? <RoomUsageHistory items={items} label={`รายการจองห้องประชุม${suffix}`}
          heading="รายการจอง" compact order={upcoming ? 'earliest' : 'latest'}
          scrollKey={`meeting-list:${viewerId ?? 'guest'}:${roomId}:${period}`} />
        : <p className="key-detail-empty">— ยังไม่มีรายการจอง{suffix} —</p>}
    </div>
  </article>
}
