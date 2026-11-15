import { RequestStepper } from '../../../shared/components/RequestStepper'
import { RequestResultIcon } from '../../../shared/components/RequestResultIcon'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { createBooking } from '../../bookings/booking.service'
import { bookingKeys } from '../../bookings/booking.queries'
import { publicRoomsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { SelectField } from '../../../shared/components/SelectField'
import { formatThaiDate } from '../../keys/utils/format-thai-date'
import { meetingBookingPolicyQuery } from '../meeting-booking-policy'
import { meetingTimeOptions } from '../utils/meeting-time-options'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'
import { staffUsageQueryKey } from '../../staff/reporting/staff-usage.queries'
import '../../keys/pages/KeyRequestFormPage.css'
import './MeetingRoomRequestPage.css'


function Row({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function BookingErrorDialog({ message, onClose }: { message: string; onClose: () => void }) { return <div className="booking-error-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div role="dialog" aria-modal="true" aria-label="ไม่สามารถจองห้องได้"><button type="button" aria-label="ปิด" onClick={onClose}>×</button><h2>ไม่สามารถจองห้องได้</h2><p>{message}</p><button type="button" className="primary-action" onClick={onClose}>ตกลง</button></div></div> }

export function MeetingRoomRequestPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const { roomId = '' } = useParams()
  const [params] = useSearchParams()
  const client = useQueryClient()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const policy = useQuery({ ...meetingBookingPolicyQuery(), enabled: Boolean(identity) })
  const [selectedDate, setDate] = useState<string | null>(params.get('date'))
  const [selectedStart, setStartTime] = useState(params.get('start') ?? '')
  const [selectedEnd, setEndTime] = useState(params.get('end') ?? '')
  const dates = policy.data?.allowed_dates ?? []
  const date = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0] ?? ''
  const availableTimes = policy.data && date
    ? meetingTimeOptions(date, new Date(), policy.data.opens_at, policy.data.closes_at) : []
  const startTimes = availableTimes.slice(0, -1)
  const startTime = startTimes.includes(selectedStart) ? selectedStart : startTimes[0] ?? ''
  const endTime = !startTime ? '' : availableTimes.includes(selectedEnd) && selectedEnd > startTime
    ? selectedEnd : availableTimes.find(time => time > startTime) ?? ''
  const [requesterIdentifier, setRequesterIdentifier] = useState('')
  const [purpose, setPurpose] = useState('')
  const [reviewSlot, setReviewSlot] = useState<{ date: string; start: string; end: string } | null>(null)
  const [formStep, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => createBooking({ roomId, startsAt: `${reviewSlot?.date}T${reviewSlot?.start}:00+07:00`, endsAt: `${reviewSlot?.date}T${reviewSlot?.end}:00+07:00`, purpose: purpose.trim(), requiresKey: true }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: [...scheduleKeys.all, 'public-events'] }),
        client.invalidateQueries({ queryKey: scheduleKeys.publicMeetingWeeks() }),
        client.invalidateQueries({ queryKey: scheduleKeys.publicMeetingBookings(roomId) }),
        client.invalidateQueries({ queryKey: bookingKeys.mine }),
        client.invalidateQueries({ queryKey: staffUsageQueryKey }),
      ])
    },
  })

  if (authLoading || rooms.isPending) return <LoadingSpinner label="กำลังโหลดแบบฟอร์ม…" />
  if (!identity) return <Navigate to={`/login?returnTo=${encodeURIComponent(`/meeting-room/${roomId}/request?${params.toString()}`)}`} replace />
  if (!room || room.usageScope !== 'MEETING') return <Navigate to="/meeting-room" replace />

  const validate = () => {
    if (!/^[0-9]+$/.test(requesterIdentifier)) return 'กรุณากรอกรหัสผู้ใช้งานเป็นตัวเลขเท่านั้น'
    if (!purpose.trim()) return 'กรุณาระบุวัตถุประสงค์'
    if (!date) return 'กรุณาเลือกวันที่จอง'
    if (!startTime || !endTime || endTime <= startTime) return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    return ''
  }
  const submit = (event: FormEvent) => { event.preventDefault(); const message = validate(); setError(message); if (!message) { setReviewSlot({ date, start: startTime, end: endTime }); setStep(2) } }
  const startOptions = startTimes.map((time) => ({ value: time, label: time }))
  const endOptions = startTime ? availableTimes.filter((time) => time > startTime).map((time) => ({ value: time, label: time })) : []
  const changeDate = (nextDate: string) => { setDate(nextDate); setStartTime(''); setEndTime('') }
  const changeStart = (nextStart: string) => { setStartTime(nextStart); if (endTime <= nextStart || !availableTimes.includes(endTime)) setEndTime(availableTimes.find((time) => time > nextStart) ?? '') }
  const step = save.isSuccess ? 3 : formStep
  const stepper = <RequestStepper step={step} label="ขั้นตอนการจองห้องประชุม" />
  const pendingApproval = save.data?.status === 'PENDING'
  const roomDisplayName = meetingRoomDisplayName(room)

  if (step === 3) return <section className="key-request-entry key-booking-form-page"><div className={`key-request-success ${pendingApproval ? 'pending' : 'approved'}`}>{stepper}<div className="key-success-card"><RequestResultIcon pending={pendingApproval} /><h1>{pendingApproval ? 'ส่งคำขอจองห้องเรียบร้อยแล้ว' : 'บันทึกการจองห้องสำเร็จ'}</h1><p>{pendingApproval ? 'กรุณารอเจ้าหน้าที่ตรวจสอบและอนุมัติคำขอ' : 'ระบบได้รับข้อมูลการจองห้องประชุมของคุณเรียบร้อยแล้ว'}</p><h2>รายละเอียดการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(reviewSlot?.date ?? date)}/><Row label="เวลาเริ่มต้น" value={`${reviewSlot?.start ?? startTime} น.`}/><Row label="เวลาสิ้นสุด" value={`${reviewSlot?.end ?? endTime} น.`}/><Row label="วัตถุประสงค์" value={purpose}/></dl></div><Link className="primary-action" to="/meeting-room">กลับสู่หน้าหลัก</Link></div></section>

  if (step === 2) return <section className="key-request-entry key-booking-form-page key-request-review"><header><h1>ตรวจสอบข้อมูล</h1><p>กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนกดยืนยัน</p></header>{stepper}<section className="key-review-card"><h2>ข้อมูลผู้จอง</h2><dl><Row label="รหัสผู้ใช้งาน" value={requesterIdentifier}/><Row label="ชื่อ – นามสกุล" value={identity.fullName}/><Row label="อีเมล" value={identity.email}/></dl></section><section className="key-review-card"><h2>ข้อมูลการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(reviewSlot?.date ?? date)}/><Row label="เวลาเริ่มต้น" value={reviewSlot?.start ?? startTime}/><Row label="เวลาสิ้นสุด" value={reviewSlot?.end ?? endTime}/><Row label="วัตถุประสงค์" value={purpose}/></dl></section>{identity.role === 'PRIORITY_USER' && <p>หากเวลาซ้อนกับรายการจองทั่วไปที่ยังไม่เริ่ม ระบบจะใช้สิทธิ์จองทับเมื่อยืนยัน</p>}<div className="key-review-actions"><button type="button" disabled={save.isPending} onClick={() => setStep(1)}>ย้อนกลับ</button><button className="primary-action review-confirm-action" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'กำลังบันทึก…' : 'ยืนยันการจอง'}</button></div>{save.error && <BookingErrorDialog message={save.error.message} onClose={() => save.reset()}/>}</section>

  return <section className="key-request-entry key-booking-form-page meeting-booking-form">
    <Link className="back-link" to={`/meeting-room/${roomId}`}>‹ กลับหน้าหลัก</Link>
    <header><h1>แบบฟอร์มการจองห้องประชุม</h1><p>กรุณากรอกข้อมูลเพื่อดำเนินการจองห้องประชุม</p></header>
    {stepper}
    <form className="key-request-form" onSubmit={submit} noValidate>
      <section className="key-form-section"><h2 className="key-section-heading">ข้อมูลผู้จอง</h2><label>รหัสผู้ใช้งาน<input aria-label="รหัสผู้ใช้งาน" inputMode="numeric" pattern="[0-9]+" required value={requesterIdentifier} onChange={(event) => setRequesterIdentifier(event.target.value.replace(/[^0-9]/g, ''))} placeholder="กรุณากรอกรหัสผู้ใช้งาน"/></label><label>ชื่อ–นามสกุล<input readOnly value={identity.fullName}/></label><label>อีเมล<input readOnly value={identity.email}/></label></section>
      <section className="key-form-section"><h2 className="key-section-heading">วัตถุประสงค์</h2><label>ระบุวัตถุประสงค์<textarea aria-label="ระบุวัตถุประสงค์" required rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="กรุณาระบุวัตถุประสงค์"/></label></section>
      <section className="key-form-section">
        <h2 className="key-section-heading">วันและเวลาที่จองห้อง</h2>
        <SelectField label="วันที่จอง" value={date} disabled={!dates.length} onChange={changeDate}
          placeholder={policy.isError ? 'ไม่สามารถโหลดวันที่เปิดจองได้' : policy.isPending ? 'กำลังโหลดวันที่เปิดจอง…' : 'ไม่มีวันที่เปิดจอง'}
          options={dates.map(day => ({ value: day, label: formatThaiDate(day) }))} />
        <div className="key-time-fields key-time-row"><SelectField label="เวลาเริ่มต้น" value={startTime} placeholder="เลือกเวลาเริ่มต้น" options={startOptions} onChange={changeStart} placement="top"/><SelectField label="เวลาสิ้นสุด" value={endTime} placeholder="เลือกเวลาสิ้นสุด" options={endOptions} onChange={setEndTime} placement="top"/></div>
        {date && !startTime && <p role="status">ไม่มีช่วงเวลาเปิดจองเหลือสำหรับวันที่เลือก</p>}
      </section>
      {error && <p className="panel-error" role="alert">{error}</p>}
      <div className="key-form-actions"><Link to={`/meeting-room/${roomId}`}>ย้อนกลับ</Link><button className="primary-action" disabled={!date || !endTime}>ถัดไป <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}
