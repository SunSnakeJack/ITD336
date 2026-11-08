import { useMutation, useQuery } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { createKeyRequest } from '../key.service'
import type { KeyRequestResult } from '../key.types'
import { validateKeyRequest } from '../utils/key-request-rules'
import { keyRequestReferenceOptionsQuery } from '../key.queries'
import { RequesterStatusSelect } from '../components/RequesterStatusSelect'
import { SelectField } from '../../../shared/components/SelectField'
import { KeyRequestReview } from '../components/KeyRequestReview'
import { KeyRequestSuccess } from '../components/KeyRequestSuccess'

const TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

function bangkokDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function KeyRequestFormPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const rooms = useQuery(publicRoomsQuery())
  const referenceOptions = useQuery(keyRequestReferenceOptionsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const date = useMemo(() => searchParams.get('date') ?? bangkokDate(), [searchParams])
  const [name, setName] = useState(identity?.fullName ?? '')
  const [email, setEmail] = useState(identity?.email ?? '')
  const [requesterType, setRequesterType] = useState<'STUDENT'|'TEACHER'>('STUDENT')
  const [requesterIdentifier, setRequesterIdentifier] = useState('')
  const [purposeType, setPurposeType] = useState<'TEACHING' | 'OTHER'>('OTHER')
  const [purpose, setPurpose] = useState('')
  const [referenceOptionId,setReferenceOptionId]=useState('')
  const [startTime, setStartTime] = useState(searchParams.get('start') ?? '08:00')
  const [endTime, setEndTime] = useState(searchParams.get('end') ?? '09:00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<KeyRequestResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const save = useMutation({ mutationFn: createKeyRequest, onSuccess: setResult })

  if (authLoading) return <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (!room || room.usageScope && room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />
  if (room.requiresSsoForKeyRequest && !identity) return <section className="key-request-entry key-auth-required"><h1>ห้องนี้ต้องเข้าสู่ระบบ</h1><p>ห้องปฏิบัติการพิเศษต้องยืนยันตัวตนด้วยบัญชีมหาวิทยาลัยก่อนส่งคำขอ</p><Link className="primary-action" to={`/login?returnTo=${encodeURIComponent(`/keys/rooms/${roomId}/request${searchParams.size ? `?${searchParams.toString()}` : ''}`)}`}>เข้าสู่ระบบมหาวิทยาลัย</Link><Link to={`/keys/rooms/${roomId}`}>กลับไปดูรายละเอียดห้อง</Link></section>
  const requesterName = room.requiresSsoForKeyRequest ? identity?.fullName ?? '' : name
  const requesterEmail = room.requiresSsoForKeyRequest ? identity?.email ?? '' : email
  const effectivePurpose = purposeType === 'TEACHING' ? 'เปิดห้องเพื่อการเรียนการสอน' : purpose
  const selectedReference = referenceOptions.data?.find((option) => option.id === referenceOptionId)
  const courseRequired = requesterType === 'STUDENT' && purposeType === 'TEACHING'

  if (result) return <KeyRequestSuccess roomCode={room.code} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} />

  const requestInput = {
    roomId, requesterName, requesterEmail, purposeType, purpose: effectivePurpose,
    startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`,
    requesterType,requesterIdentifier,referenceOptionId:courseRequired ? referenceOptionId || undefined : undefined,
  }

  if (reviewing) return <KeyRequestReview roomCode={room.code} requesterIdentifier={requesterIdentifier} requesterName={requesterName} requesterEmail={requesterEmail} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} courseCode={courseRequired ? selectedReference?.courseCode : undefined} lecturerName={courseRequired ? selectedReference?.lecturerName : undefined} submitting={save.isPending} error={save.error?.message} onBack={() => setReviewing(false)} onConfirm={() => save.mutate(requestInput)} />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const startsAt = `${date}T${startTime}:00+07:00`
    const endsAt = `${date}T${endTime}:00+07:00`
    const ruleResult = validateKeyRequest({ email: requesterEmail, startsAt, endsAt })
    const nextErrors: Record<string, string> = { ...ruleResult.errors }
    if (!requesterName.trim()) nextErrors.name = 'กรุณากรอกชื่อ–นามสกุล'
    if (!requesterIdentifier.trim()) nextErrors.requesterIdentifier = 'กรุณากรอกรหัสนักศึกษา / บุคลากร'
    if (purposeType === 'OTHER' && !purpose.trim()) nextErrors.purpose = 'กรุณาระบุวัตถุประสงค์'
    if (endTime <= startTime) nextErrors.time = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    if (courseRequired) {
      if (!referenceOptionId) nextErrors.referenceOptionId = 'กรุณาเลือกวิชาและอาจารย์ผู้สอน'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setReviewing(true)
  }

  return <section className="key-request-entry"><Link className="back-link" to={`/keys/rooms/${roomId}`}>← กลับไปเลือกห้อง</Link><header><span className="key-request-kicker">{room.code} · {room.name}</span><h1>แบบฟอร์มเบิกกุญแจ</h1><p>{room.requiresSsoForKeyRequest ? 'คำขอนี้ต้องรอเจ้าหน้าที่อนุมัติ' : 'ห้องทั่วไปอนุมัติอัตโนมัติหลังตรวจสอบข้อมูล'}</p></header><div className="key-stepper" aria-label="ขั้นตอนการเบิกกุญแจ"><b>1</b><i/><b>2</b><i/><b>3</b></div>
    <form className="key-request-form" onSubmit={submit} noValidate>
      <div className="key-identity-row"><RequesterStatusSelect value={requesterType} onChange={(value)=>{setRequesterType(value);if(value==='TEACHER')setReferenceOptionId('')}}/><label>รหัสนักศึกษา / บุคลากร<input required value={requesterIdentifier} onChange={(event)=>setRequesterIdentifier(event.target.value)}/>{errors.requesterIdentifier&&<small role="alert">{errors.requesterIdentifier}</small>}</label></div>
      <label>ชื่อ–นามสกุล<input required value={requesterName} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setName(event.target.value)} />{errors.name && <small role="alert">{errors.name}</small>}</label>
      <label>อีเมลมหาวิทยาลัย<input type="email" required placeholder="name@northbkk.ac.th" value={requesterEmail} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setEmail(event.target.value)} />{errors.email && <small role="alert">{errors.email}</small>}</label>
      <fieldset className="key-purpose-options"><legend>วัตถุประสงค์</legend><label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='TEACHING'} onChange={()=>{setPurposeType('TEACHING');setPurpose('')}}/><span>เปิดห้องเพื่อการเรียนการสอน</span></label><label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='OTHER'} onChange={()=>{setPurposeType('OTHER');setReferenceOptionId('')}}/><span>อื่น ๆ</span></label></fieldset>
      {courseRequired && (
        <SelectField
          label="วิชาและอาจารย์ผู้สอน"
          value={referenceOptionId}
          placeholder="กรุณาเลือกวิชา"
          options={(referenceOptions.data ?? []).map((option) => ({
            value: option.id,
            label: `${option.courseCode} · ${option.lecturerName}`,
          }))}
          onChange={setReferenceOptionId}
          error={errors.referenceOptionId}
        />
      )}
      {purposeType === 'OTHER' && <label className="key-purpose">รายละเอียดวัตถุประสงค์<textarea required rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} />{errors.purpose && <small role="alert">{errors.purpose}</small>}</label>}
      <label>วันที่<input className="key-readonly-date" type="date" value={date} readOnly aria-readonly="true" /></label>
      <div className="key-time-fields key-time-row"><label>เวลาเริ่ม<select className="key-select" value={startTime} onChange={(event) => setStartTime(event.target.value)}>{TIME_OPTIONS.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><label>เวลาคืน<select className="key-select" value={endTime} onChange={(event) => setEndTime(event.target.value)}>{TIME_OPTIONS.slice(1).map((time) => <option key={time}>{time}</option>)}</select></label></div>
      {(errors.date || errors.time || save.error) && <p className="panel-error" role="alert">{errors.date ?? errors.time ?? save.error?.message}</p>}
      <div className="key-form-actions"><Link to={`/keys/rooms/${roomId}`}>ย้อนกลับ</Link><button className="primary-action">ถัดไป</button></div>
    </form>
  </section>
}
