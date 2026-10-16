import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SCHEDULE_TIMES } from '../../schedules/components/WeeklySchedule'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { bookingKeys } from '../booking.queries'
import { createBooking } from '../booking.service'

const END_TIMES = [...SCHEDULE_TIMES.slice(1), '18:30']

export function UserBookingForm({ roomId, date, time, requiresKey, onClose }: { roomId: string; date: string; time: string; requiresKey: boolean; onClose: () => void }) {
  const client = useQueryClient()
  const [startTime, setStartTime] = useState(time)
  const [endTime, setEndTime] = useState(END_TIMES.find((value) => value > time) ?? '18:30')
  const [reason, setReason] = useState('')
  const save = useMutation({
    mutationFn: () => createBooking({ roomId, startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`, purpose: reason, requiresKey }),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: scheduleKeys.all }), client.invalidateQueries({ queryKey: bookingKeys.mine })]); onClose() },
  })
  const endOptions = END_TIMES.filter((value) => value > startTime)
  const title = requiresKey ? 'เบิกกุญแจห้อง' : 'จองห้อง'
  return <div className="schedule-dialog-backdrop" role="presentation"><form className="schedule-dialog user-booking-dialog" aria-label={title} onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
    <header><div><h2>{title}</h2><p>{date} · {startTime}</p></div><button aria-label="ปิด" type="button" onClick={onClose}>×</button></header>
    <label className="booking-reason">{requiresKey ? 'เหตุผลในการเบิก' : 'เหตุผลในการจอง'}<input autoFocus required value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <label>เวลาเริ่ม<select required value={startTime} onChange={(event) => { const next = event.target.value; setStartTime(next); setEndTime(END_TIMES.find((value) => value > next) ?? '18:30') }}>{SCHEDULE_TIMES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>เวลาสิ้นสุด<select required value={endTime} onChange={(event) => setEndTime(event.target.value)}>{endOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
    {save.error && <p className="panel-error">{save.error.message}</p>}
    <div className="form-actions"><span /><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : requiresKey ? 'ยืนยันการเบิกกุญแจ' : 'ยืนยันการจอง'}</button></div>
  </form></div>
}
