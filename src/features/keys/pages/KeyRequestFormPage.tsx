import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { createKeyRequest } from '../key.service'
import type { KeyRequestResult } from '../key.types'
import { validateKeyRequest } from '../utils/key-request-rules'
import { keyLoanKeys, keyRequestReferenceOptionsQuery } from '../key.queries'
import { RequesterStatusSelect } from '../components/RequesterStatusSelect'
import { KeyRequestReview } from '../components/KeyRequestReview'
import { KeyRequestSuccess } from '../components/KeyRequestSuccess'
import './KeyRequestFormPage.css'

const TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

function bangkokDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function KeyRequestFormPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const queryClient = useQueryClient()
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const rooms = useQuery(publicRoomsQuery())
  const referenceOptions = useQuery(keyRequestReferenceOptionsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const date = useMemo(() => searchParams.get('date') ?? bangkokDate(), [searchParams])
  const [name, setName] = useState(identity?.fullName ?? '')
  const [email, setEmail] = useState(identity?.email ?? '')
  const [requesterType, setRequesterType] = useState<'STUDENT'|'TEACHER'>(() => identity?.role === 'TEACHER' ? 'TEACHER' : 'STUDENT')
  const [requesterIdentifier, setRequesterIdentifier] = useState('')
  const [purposeType, setPurposeType] = useState<'TEACHING' | 'OTHER' | null>(null)
  const [purpose, setPurpose] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [referenceOptionId, setReferenceOptionId] = useState('')
  const [startTime, setStartTime] = useState(searchParams.get('start') ?? '08:00')
  const [endTime, setEndTime] = useState(searchParams.get('end') ?? '09:00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<KeyRequestResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const save = useMutation({ mutationFn: createKeyRequest, onSuccess: async (created) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
      queryClient.invalidateQueries({ queryKey: keyLoanKeys.all }),
    ])
    setResult(created)
  } })

  if (authLoading) return <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (!room || room.usageScope && room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />
  if (room.requiresSsoForKeyRequest && !identity) return <section className="key-request-entry key-auth-required"><h1>ห้องนี้ต้องเข้าสู่ระบบ</h1><p>ห้องปฏิบัติการพิเศษต้องยืนยันตัวตนด้วยบัญชีมหาวิทยาลัยก่อนส่งคำขอ</p><Link className="primary-action" to={`/login?returnTo=${encodeURIComponent(`/keys/rooms/${roomId}/request${searchParams.size ? `?${searchParams.toString()}` : ''}`)}`}>เข้าสู่ระบบมหาวิทยาลัย</Link><Link to={`/keys/rooms/${roomId}`}>กลับไปดูรายละเอียดห้อง</Link></section>
  const requesterName = room.requiresSsoForKeyRequest ? identity?.fullName ?? '' : name
  const requesterEmail = room.requiresSsoForKeyRequest ? identity?.email ?? '' : email
  const effectivePurpose = purposeType === 'TEACHING' ? 'เปิดห้องเพื่อการเรียนการสอน' : purpose
  const selectedReference = referenceOptions.data?.find((option) => option.id === referenceOptionId)
  const courseRequired = purposeType === 'TEACHING'

  if (result) return <KeyRequestSuccess status={result.status} roomCode={room.code} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} />

  const requestInput = {
    roomId, requesterName, requesterEmail, purposeType: purposeType ?? 'OTHER', purpose: effectivePurpose,
    startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`,
    requesterType, requesterIdentifier, referenceOptionId: courseRequired && requesterType === 'STUDENT' ? referenceOptionId || undefined : undefined,
  }

  if (reviewing) return <KeyRequestReview roomCode={room.code} requesterIdentifier={requesterIdentifier} requesterName={requesterName} requesterEmail={requesterEmail} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} courseCode={courseRequired ? (courseCode.trim() || selectedReference?.courseCode) : undefined} lecturerName={courseRequired ? selectedReference?.lecturerName : undefined} submitting={save.isPending} error={save.error?.message} onBack={() => setReviewing(false)} onConfirm={() => save.mutate(requestInput)} />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const startsAt = `${date}T${startTime}:00+07:00`
    const endsAt = `${date}T${endTime}:00+07:00`
    const ruleResult = validateKeyRequest({ email: requesterEmail, startsAt, endsAt })
    const nextErrors: Record<string, string> = { ...ruleResult.errors }
    if (!requesterName.trim()) nextErrors.name = 'กรุณากรอกชื่อ–นามสกุล'
    if (!requesterIdentifier.trim()) nextErrors.requesterIdentifier = 'กรุณากรอกรหัสนักศึกษา / บุคลากร'
    if (!purposeType) nextErrors.purposeType = 'กรุณาเลือกวัตถุประสงค์'
    if (purposeType === 'OTHER' && !purpose.trim()) nextErrors.purpose = 'กรุณาระบุวัตถุประสงค์'
    if (endTime <= startTime) nextErrors.time = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    if (courseRequired) {
      if (!courseCode.trim()) nextErrors.courseCode = 'กรุณากรอกรหัสวิชา'
      if (requesterType === 'STUDENT' && !referenceOptionId) {
        nextErrors.referenceOptionId = 'กรุณาเลือกอาจารย์ผู้สอน'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setReviewing(true)
  }

  return <section className="key-request-entry key-booking-form-page"><Link className="back-link" to="/keys">‹ กลับหน้าหลัก</Link><header><h1>แบบฟอร์มการเบิกกุญแจ</h1><p>กรุณากรอกข้อมูลเพื่อดำเนินการเบิกกุญแจ</p></header><div className="key-stepper" aria-label="ขั้นตอนการเบิกกุญแจ"><b aria-current="step">1</b><i/><b>2</b><i/><b>3</b></div>
    <form className="key-request-form" onSubmit={submit} noValidate>
      <section className="key-form-section" aria-labelledby="requester-heading"><h2 id="requester-heading"><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ข้อมูลผู้เบิกกุญแจ</h2><div className="key-identity-row"><RequesterStatusSelect value={requesterType} onChange={setRequesterType}/><label>รหัสนักศึกษา / บุคลากร<input aria-label="รหัสนักศึกษา / บุคลากร" required placeholder="กรุณากรอกรหัส" value={requesterIdentifier} onChange={(event)=>setRequesterIdentifier(event.target.value)}/>{errors.requesterIdentifier&&<small role="alert">{errors.requesterIdentifier}</small>}</label></div>
      <label>ชื่อ–นามสกุล<input aria-label="ชื่อ–นามสกุล" required placeholder="กรุณากรอกชื่อ–นามสกุล" value={requesterName} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setName(event.target.value)} />{errors.name && <small role="alert">{errors.name}</small>}</label>
      <label>อีเมล<input aria-label="อีเมล" type="email" required placeholder="name@northbkk.ac.th" value={requesterEmail} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setEmail(event.target.value)} />{errors.email && <small role="alert">{errors.email}</small>}</label></section>
      <fieldset className="key-purpose-options"><legend><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/></svg> วัตถุประสงค์</legend><label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='TEACHING'} onChange={()=>setPurposeType('TEACHING')}/><span>เพื่อเปิดห้องการเรียนการสอน</span></label>{courseRequired && <div className="key-purpose-fields">
          <div className="key-purpose-row"><label htmlFor="course-code-input">รหัสวิชา</label><div className="key-purpose-input-wrap"><input id="course-code-input" aria-label="รหัสวิชา" placeholder="กรุณากรอกรหัสวิชา" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />{errors.courseCode && <small role="alert">{errors.courseCode}</small>}</div></div>
          {requesterType === 'STUDENT' && <div className="key-purpose-row"><label htmlFor="lecturer-select">อาจารย์ผู้สอน</label><div className="key-purpose-input-wrap"><select id="lecturer-select" aria-label="อาจารย์ผู้สอน" className="key-select" value={referenceOptionId} onChange={(event) => {
            const optId = event.target.value
            setReferenceOptionId(optId)
            const found = referenceOptions.data?.find((option) => option.id === optId)
            if (found && !courseCode.trim()) setCourseCode(found.courseCode)
          }}><option value="">กรุณาเลือกชื่ออาจารย์ผู้สอน</option>{(referenceOptions.data ?? []).map((option) => <option key={option.id} value={option.id}>{option.lecturerName}</option>)}</select>{errors.referenceOptionId && <small role="alert">{errors.referenceOptionId}</small>}</div></div>}
        </div>}<label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='OTHER'} onChange={()=>setPurposeType('OTHER')}/><span>อื่นๆ</span></label>
      {purposeType === 'OTHER' && <div className="key-other-purpose-fields"><label><span>ระบุวัตถุประสงค์</span><textarea aria-label="ระบุวัตถุประสงค์" required rows={2} placeholder="กรุณาระบุ เช่น ประชุมโครงงาน หรือจัดกิจกรรม" value={purpose} onChange={(event) => setPurpose(event.target.value)} />{errors.purpose && <small role="alert">{errors.purpose}</small>}</label></div>}{errors.purposeType&&<small role="alert">{errors.purposeType}</small>}</fieldset>
      <section className="key-form-section key-date-time-section" aria-labelledby="date-time-heading"><h2 id="date-time-heading"><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> เวลาที่เบิกกุญแจ</h2>
      <div className="key-time-fields key-time-row"><label>เวลาเริ่มต้น<select className="key-select" aria-label="เวลาเริ่มต้น" value={startTime} onChange={(event) => setStartTime(event.target.value)}>{TIME_OPTIONS.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><label>เวลาสิ้นสุด<select className="key-select" aria-label="เวลาสิ้นสุด" value={endTime} onChange={(event) => setEndTime(event.target.value)}>{TIME_OPTIONS.slice(1).map((time) => <option key={time}>{time}</option>)}</select></label></div></section>
      {(errors.date || errors.time || save.error) && <p className="panel-error" role="alert">{errors.date ?? errors.time ?? save.error?.message}</p>}
      <div className="key-form-actions"><Link to={`/keys/rooms/${roomId}`}>ย้อนกลับ</Link><button className="primary-action">ถัดไป <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}
