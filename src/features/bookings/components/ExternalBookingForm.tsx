import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { SCHEDULE_TIMES } from '../../schedules/components/WeeklySchedule'
import { createExternalBooking, getExternalBookingForEdit, updateExternalBooking } from '../external-booking.service'
import type { ExternalBookingDetail, ExternalBookingInput } from '../external-booking.types'

const END_TIMES = [...SCHEDULE_TIMES.slice(1), '18:30']

function Editor({ roomId, date, time, booking, onClose }: { roomId: string; date: string; time: string; booking?: ExternalBookingDetail; onClose: () => void }) {
  const client = useQueryClient()
  const [form, setForm] = useState<ExternalBookingInput>({
    bookingId: booking?.bookingId, roomId, date: booking?.date ?? date, startTime: booking?.startTime ?? time,
    endTime: booking?.endTime ?? END_TIMES.find((value) => value > time) ?? '18:30', externalName: booking?.externalName ?? '', reason: booking?.reason ?? '',
  })
  const save = useMutation({ mutationFn: booking ? updateExternalBooking : createExternalBooking, onSuccess: async () => { await client.invalidateQueries({ queryKey: scheduleKeys.all }); onClose() } })
  const endOptions = END_TIMES.filter((value) => value > form.startTime)
  return <div className="schedule-dialog-backdrop" role="presentation"><form className="schedule-dialog" aria-label={booking ? 'แก้ไขการจองบุคคลภายนอก' : 'จองห้องสำหรับบุคคลภายนอก'} onSubmit={(event) => { event.preventDefault(); save.mutate(form) }}>
    <header><div><h2>{booking ? 'แก้ไขการจองบุคคลภายนอก' : 'จองห้องสำหรับบุคคลภายนอก'}</h2><p>{form.date} · {form.startTime}</p></div><button aria-label="ปิด" type="button" onClick={onClose}>×</button></header>
    <label>ชื่อบุคคลภายนอก<input autoFocus required value={form.externalName} onChange={(event) => setForm({ ...form, externalName: event.target.value })} /></label>
    <label>เหตุผลการจอง<input required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
    <label>เวลาเริ่ม<select required value={form.startTime} onChange={(event) => { const startTime = event.target.value; setForm({ ...form, startTime, endTime: END_TIMES.find((value) => value > startTime) ?? '18:30' }) }}>{SCHEDULE_TIMES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>เวลาสิ้นสุด<select required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })}>{endOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
    {save.error && <p className="panel-error">{save.error.message}</p>}
    <div className="form-actions"><span /><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : booking ? 'บันทึกการแก้ไข' : 'บันทึกการจอง'}</button></div>
  </form></div>
}

export function ExternalBookingForm({ roomId, date, time, bookingId, onClose }: { roomId: string; date: string; time: string; bookingId?: string; onClose: () => void }) {
  const booking = useQuery({ queryKey: ['external-booking', bookingId], queryFn: () => getExternalBookingForEdit(bookingId as string), enabled: Boolean(bookingId), retry: false })
  if (bookingId && booking.isPending) return <div className="schedule-dialog-backdrop"><div className="schedule-dialog-loading">กำลังโหลดข้อมูลการจอง…</div></div>
  if (booking.error || (bookingId && !booking.data)) return <div className="schedule-dialog-backdrop"><div className="schedule-dialog-loading"><p className="panel-error">{booking.error?.message ?? 'ไม่สามารถโหลดข้อมูลการจองได้'}</p><button onClick={onClose}>ปิด</button></div></div>
  return <Editor key={bookingId ?? `${date}-${time}`} roomId={roomId} date={date} time={time} booking={booking.data} onClose={onClose} />
}
