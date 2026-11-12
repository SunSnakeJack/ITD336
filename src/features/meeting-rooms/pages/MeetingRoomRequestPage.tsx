import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { createBooking } from '../../bookings/booking.service'
import { bookingKeys } from '../../bookings/booking.queries'
import { publicRoomsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { SelectField } from '../../../shared/components/SelectField'
import { formatThaiDate } from '../../keys/utils/format-thai-date'
import { meetingTimeOptions } from '../utils/meeting-time-options'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'
import '../../keys/pages/KeyRequestFormPage.css'
import './MeetingRoomRequestPage.css'

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())

function Row({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function BookingErrorDialog({ message, onClose }: { message: string; onClose: () => void }) { return <div className="booking-error-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div role="dialog" aria-modal="true" aria-label="ไม่สามารถจองห้องได้"><button type="button" aria-label="ปิด" onClick={onClose}>×</button><h2>ไม่สามารถจองห้องได้</h2><p>{message}</p><button type="button" className="primary-action" onClick={onClose}>ตกลง</button></div></div> }

export function MeetingRoomRequestPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const client = useQueryClient()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const initialDate = useMemo(() => params.get('date') ?? today(), [params])
  const initialTimes = useMemo(() => meetingTimeOptions(initialDate), [initialDate])
  const [date, setDate] = useState(initialDate)
  const [startTime, setStartTime] = useState(() => { const requested = params.get('start'); return requested && initialTimes.includes(requested) ? requested : initialTimes[0] ?? '' })
  const [endTime, setEndTime] = useState(() => { const requestedStart = params.get('start') ?? initialTimes[0] ?? ''; const requestedEnd = params.get('end'); return requestedEnd && initialTimes.includes(requestedEnd) && requestedEnd > requestedStart ? requestedEnd : initialTimes.find((time) => time > requestedStart) ?? '' })
  const [requesterIdentifier, setRequesterIdentifier] = useState('')
  const [purpose, setPurpose] = useState('')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState('')
  const save = useMutation({ mutationFn: () => createBooking({ roomId, startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`, purpose: purpose.trim(), requiresKey: true }), onSuccess: async () => { setStep(3); await Promise.all([client.invalidateQueries({ queryKey: [...scheduleKeys.all, 'public-events'] }), client.invalidateQueries({ queryKey: bookingKeys.mine })]) } })

  if (authLoading || rooms.isPending) return <LoadingSpinner label="กำลังโหลดแบบฟอร์ม…" />
  if (!identity) return <Navigate to={`/login?returnTo=${encodeURIComponent(`/meeting-room/${roomId}/request?${params.toString()}`)}`} replace />
  if (!room || room.usageScope !== 'MEETING') return <Navigate to="/meeting-room" replace />

  const validate = () => {
    if (!requesterIdentifier.trim()) return 'กรุณากรอกรหัสผู้ใช้งาน'
    if (!purpose.trim()) return 'กรุณาระบุวัตถุประสงค์'
    if (!date) return 'กรุณาเลือกวันที่จอง'
    if (endTime <= startTime) return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    return ''
  }
  const submit = (event: FormEvent) => { event.preventDefault(); const message = validate(); setError(message); if (!message) setStep(2) }
  const availableTimes = meetingTimeOptions(date)
  const startOptions = availableTimes.slice(0, -1).map((time) => ({ value: time, label: time }))
  const endOptions = availableTimes.filter((time) => time > startTime).map((time) => ({ value: time, label: time }))
  const changeDate = (nextDate: string) => { const options = meetingTimeOptions(nextDate); const nextStart = options.slice(0, -1)[0] ?? ''; setDate(nextDate); setStartTime(nextStart); setEndTime(options.find((time) => time > nextStart) ?? '') }
  const changeStart = (nextStart: string) => { setStartTime(nextStart); if (endTime <= nextStart || !availableTimes.includes(endTime)) setEndTime(availableTimes.find((time) => time > nextStart) ?? '') }
  const stepper = <div className="key-stepper" aria-label="ขั้นตอนการจองห้องประชุม"><b aria-current={step === 1 ? 'step' : undefined}>1</b><i/><b aria-current={step === 2 ? 'step' : undefined}>2</b><i/><b aria-current={step === 3 ? 'step' : undefined}>3</b></div>
  const roomDisplayName = meetingRoomDisplayName(room)

  if (step === 3) return <section className="key-request-entry key-booking-form-page"><div className="key-request-success approved">{stepper}<div className="key-success-card"><span className="key-success-symbol" aria-hidden="true">✓</span><h1>บันทึกการจองห้องสำเร็จ</h1><p>ระบบได้รับข้อมูลการจองห้องประชุมของคุณเรียบร้อยแล้ว</p><h2>รายละเอียดการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(date)}/><Row label="เวลาเริ่มต้น" value={`${startTime} น.`}/><Row label="เวลาสิ้นสุด" value={`${endTime} น.`}/><Row label="วัตถุประสงค์" value={purpose}/></dl></div><Link className="primary-action" to="/meeting-room">กลับสู่หน้าหลัก</Link></div></section>

  if (step === 2) return <section className="key-request-entry key-booking-form-page key-request-review"><header><h1>ตรวจสอบข้อมูล</h1><p>กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนกดยืนยัน</p></header>{stepper}<section className="key-review-card"><h2>ข้อมูลผู้จอง</h2><dl><Row label="รหัสผู้ใช้งาน" value={requesterIdentifier}/><Row label="ชื่อ – นามสกุล" value={identity.fullName}/><Row label="อีเมล" value={identity.email}/></dl></section><section className="key-review-card"><h2>ข้อมูลการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(date)}/><Row label="เวลาเริ่มต้น" value={startTime}/><Row label="เวลาสิ้นสุด" value={endTime}/><Row label="วัตถุประสงค์" value={purpose}/></dl></section><div className="key-review-actions"><button type="button" onClick={() => setStep(1)}>ย้อนกลับ</button><button className="primary-action review-confirm-action" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'กำลังบันทึก…' : 'ยืนยันการจอง'}</button></div>{save.error && <BookingErrorDialog message={save.error.message} onClose={() => save.reset()}/>}</section>

  return <section className="key-request-entry key-booking-form-page meeting-booking-form">
    <Link className="back-link" to={`/meeting-room/${roomId}`}>‹ กลับหน้าหลัก</Link>
    <header><h1>แบบฟอร์มการจองห้องประชุม</h1><p>กรุณากรอกข้อมูลเพื่อดำเนินการจองห้องประชุม</p></header>
    {stepper}
    <form className="key-request-form" onSubmit={submit} noValidate>
      <section className="key-form-section"><h2 className="key-section-heading">ข้อมูลผู้จอง</h2><label>รหัสผู้ใช้งาน<input aria-label="รหัสผู้ใช้งาน" required value={requesterIdentifier} onChange={(event) => setRequesterIdentifier(event.target.value)} placeholder="กรุณากรอกรหัสผู้ใช้งาน"/></label><label>ชื่อ–นามสกุล<input readOnly value={identity.fullName}/></label><label>อีเมล<input readOnly value={identity.email}/></label></section>
      <section className="key-form-section"><h2 className="key-section-heading">วัตถุประสงค์</h2><label>ระบุวัตถุประสงค์<textarea aria-label="ระบุวัตถุประสงค์" required rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="กรุณาระบุวัตถุประสงค์"/></label></section>
      <section className="key-form-section"><h2 className="key-section-heading">วันและเวลาที่จองห้อง</h2><label>วันที่จอง<input aria-label="วันที่จอง" type="date" required value={date} min={today()} onChange={(event) => changeDate(event.target.value)}/></label><div className="key-time-fields key-time-row"><SelectField label="เวลาเริ่มต้น" value={startTime} placeholder="เลือกเวลาเริ่มต้น" options={startOptions} onChange={changeStart} placement="top"/><SelectField label="เวลาสิ้นสุด" value={endTime} placeholder="เลือกเวลาสิ้นสุด" options={endOptions} onChange={setEndTime} placement="top"/></div></section>
      {error && <p className="panel-error" role="alert">{error}</p>}
      <div className="key-form-actions"><Link to={`/meeting-room/${roomId}`}>ย้อนกลับ</Link><button className="primary-action">ถัดไป <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}
