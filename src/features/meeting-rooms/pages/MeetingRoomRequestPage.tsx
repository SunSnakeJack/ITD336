import { RequestStepper } from '../../../shared/components/RequestStepper'
import { RequestResultIcon } from '../../../shared/components/RequestResultIcon'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { getRequesterStatus, hasPriorityRole, ROLE_LABELS, type AuthIdentity } from '../../auth/auth.types'
import { createBooking } from '../../bookings/booking.service'
import { bookingKeys } from '../../bookings/booking.queries'
import { publicRoomsQuery, publicScheduleEventsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { SelectField } from '../../../shared/components/SelectField'
import { formatThaiDate } from '../../keys/utils/format-thai-date'
import { meetingBookingPolicyQuery } from '../meeting-booking-policy'
import { canOverrideMeetingEvent, meetingTimeOptions } from '../utils/meeting-time-options'
import { meetingRoomDisplayName } from '../utils/meeting-room-display'
import { staffUsageQueryKey } from '../../staff/reporting/staff-usage.queries'
import '../../keys/pages/KeyRequestFormPage.css'
import { availableEndTimes, isHalfHourOccupied, timeSelectOptions } from '../../schedules/request-time-options'
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
  const schedule = useQuery({ ...publicScheduleEventsQuery({ roomId, from: date, to: date }), enabled: Boolean(date && roomId && identity) })
  const now = new Date()
  const availableTimes = policy.data && date
    ? meetingTimeOptions(date, now, policy.data.opens_at, policy.data.closes_at) : []
  const blockingEvents = (schedule.data ?? []).filter((event) => !canOverrideMeetingEvent(identity, event, now))
  const unavailable = (time: string) => isHalfHourOccupied(date, time, blockingEvents)
  const startOptions = timeSelectOptions(availableTimes.slice(0, -1), unavailable)
  const startTime = selectedStart
    ? startOptions.find((option) => option.value === selectedStart && !option.disabled)?.value ?? ''
    : startOptions.find((option) => !option.disabled)?.value ?? ''
  const endOptions = timeSelectOptions(availableEndTimes(availableTimes, startTime, unavailable))
  const endTime = selectedEnd
    ? endOptions.find((option) => option.value === selectedEnd)?.value ?? ''
    : endOptions[0]?.value ?? ''

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
    if (!purpose.trim()) return 'กรุณาระบุวัตถุประสงค์'
    if (!date) return 'กรุณาเลือกวันที่จอง'
    if (!schedule.isSuccess) return 'ไม่สามารถตรวจสอบช่วงเวลาว่างได้'
    if (!startTime || !endTime || endTime <= startTime) return 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    return ''
  }
  const submit = (event: FormEvent) => { event.preventDefault(); const message = validate(); setError(message); if (!message) { setReviewSlot({ date, start: startTime, end: endTime }); setStep(2) } }
  const changeDate = (nextDate: string) => { setDate(nextDate); setStartTime(''); setEndTime('') }
  const changeStart = (nextStart: string) => { setStartTime(nextStart); setEndTime('') }
  const step = save.isSuccess ? 3 : formStep
  const stepper = <RequestStepper step={step} label="ขั้นตอนการจองห้องประชุม" />
  const pendingApproval = save.data?.status === 'PENDING'
  const requesterStatus = getRequesterStatus(identity) ?? identity.role
  const roomDisplayName = meetingRoomDisplayName(room)

  if (step === 3) return <section className="key-request-entry key-booking-form-page"><div className={`key-request-success ${pendingApproval ? 'pending' : 'approved'}`}>{stepper}<div className="key-success-card"><RequestResultIcon pending={pendingApproval} /><h1>{pendingApproval ? 'ส่งคำขอจองห้องเรียบร้อยแล้ว' : 'บันทึกการจองห้องสำเร็จ'}</h1><p>{pendingApproval ? 'กรุณารอเจ้าหน้าที่ตรวจสอบและอนุมัติคำขอ' : 'ระบบได้รับข้อมูลการจองห้องประชุมของคุณเรียบร้อยแล้ว'}</p><h2>รายละเอียดการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(reviewSlot?.date ?? date)}/><Row label="เวลาเริ่มต้น" value={`${reviewSlot?.start ?? startTime} น.`}/><Row label="เวลาสิ้นสุด" value={`${reviewSlot?.end ?? endTime} น.`}/><Row label="วัตถุประสงค์" value={purpose}/></dl></div><Link className="primary-action" to="/meeting-room">กลับสู่หน้าหลัก</Link></div></section>

  if (step === 2) return <section className="key-request-entry key-booking-form-page key-request-review"><header><h1>ตรวจสอบข้อมูล</h1><p>กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนกดยืนยัน</p></header>{stepper}<section className="key-review-card"><h2>ข้อมูลผู้จอง</h2><dl><Row label="ชื่อ – นามสกุล" value={identity.fullName}/><Row label="อีเมล" value={identity.email}/></dl></section><section className="key-review-card"><h2>ข้อมูลการจอง</h2><dl><Row label="ห้องที่จอง" value={roomDisplayName}/><Row label="วันที่จอง" value={formatThaiDate(reviewSlot?.date ?? date)}/><Row label="เวลาเริ่มต้น" value={reviewSlot?.start ?? startTime}/><Row label="เวลาสิ้นสุด" value={reviewSlot?.end ?? endTime}/><Row label="วัตถุประสงค์" value={purpose}/></dl></section>{hasPriorityRole(identity) && <p>หากเวลาซ้อนกับรายการจองทั่วไปที่ยังไม่เริ่ม ระบบจะใช้สิทธิ์จองทับเมื่อยืนยัน</p>}<div className="key-review-actions"><button type="button" disabled={save.isPending} onClick={() => setStep(1)}>ย้อนกลับ</button><button className="primary-action review-confirm-action" type="button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'กำลังบันทึก…' : 'ยืนยันการจอง'}</button></div>{save.error && <BookingErrorDialog message={save.error.message} onClose={() => save.reset()}/>}</section>

  return <section className="key-request-entry key-booking-form-page meeting-booking-form">
    <Link className="back-link" to={`/meeting-room/${roomId}`}>‹ กลับหน้าหลัก</Link>
    <header><h1>แบบฟอร์มการจองห้องประชุม</h1><p>กรุณากรอกข้อมูลเพื่อดำเนินการจองห้องประชุม</p></header>
    {stepper}
    <form className="key-request-form" onSubmit={submit} noValidate>
      <section className="key-form-section"><h2 className="key-section-heading">ข้อมูลผู้จอง</h2><div className="key-identity-row"><label>สถานะ<input readOnly value={requesterStatus ? ROLE_LABELS[requesterStatus] : 'ผู้ใช้งาน'}/></label><label>ชื่อ–นามสกุล<input readOnly value={identity.fullName}/></label></div><label>อีเมล<input readOnly value={identity.email}/></label></section>
      <section className="key-form-section"><h2 className="key-section-heading">วัตถุประสงค์</h2><label>ระบุวัตถุประสงค์<textarea aria-label="ระบุวัตถุประสงค์" required rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="กรุณาระบุวัตถุประสงค์"/></label></section>
      <section className="key-form-section">
        <h2 className="key-section-heading">วันและเวลาที่จองห้อง</h2>
        <SelectField label="วันที่จอง" value={date} disabled={!dates.length} onChange={changeDate}
          placeholder={policy.isError ? 'ไม่สามารถโหลดวันที่เปิดจองได้' : policy.isPending ? 'กำลังโหลดวันที่เปิดจอง…' : 'ไม่มีวันที่เปิดจอง'}
          options={dates.map(day => ({ value: day, label: formatThaiDate(day) }))} />
        <div className="key-time-fields key-time-row"><SelectField label="เวลาเริ่มต้น" value={startTime} placeholder="เลือกเวลาเริ่มต้น" options={startOptions} onChange={changeStart} placement="top"/><SelectField label="เวลาสิ้นสุด" value={endTime} placeholder="เลือกเวลาสิ้นสุด" options={endOptions} disabled={!startTime} onChange={setEndTime} placement="top"/></div>
        {date && !startTime && <p role="status">ไม่มีช่วงเวลาเปิดจองเหลือสำหรับวันที่เลือก</p>}
      </section>
      {error && <p className="panel-error" role="alert">{error}</p>}
      <div className="key-form-actions"><Link to={`/meeting-room/${roomId}`}>ย้อนกลับ</Link><button className="primary-action" disabled={!date || !endTime || !schedule.isSuccess}>ถัดไป <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}
