import { useMutation, useQuery } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { createKeyRequest } from '../key.service'
import type { KeyRequestResult } from '../key.types'
import { validateKeyRequest } from '../utils/key-request-rules'

const TIME_OPTIONS = Array.from({ length: 21 }, (_, index) => {
  const minutes = 8 * 60 + index * 30
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

function bangkokDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function KeyRequestFormPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const date = useMemo(bangkokDate, [])
  const [name, setName] = useState(identity?.fullName ?? '')
  const [email, setEmail] = useState(identity?.email ?? '')
  const [purposeType, setPurposeType] = useState<'TEACHING' | 'OTHER'>('OTHER')
  const [purpose, setPurpose] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [courseName, setCourseName] = useState('')
  const [lecturerName, setLecturerName] = useState('')
  const [lecturerEmail, setLecturerEmail] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<KeyRequestResult | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const save = useMutation({ mutationFn: createKeyRequest, onSuccess: setResult })

  if (authLoading) return <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (!room || room.usageScope && room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />
  if (room.requiresSsoForKeyRequest && !identity) return <section className="key-request-entry key-auth-required"><h1>ห้องนี้ต้องเข้าสู่ระบบ</h1><p>ห้องปฏิบัติการพิเศษต้องยืนยันตัวตนด้วยบัญชีมหาวิทยาลัยก่อนส่งคำขอ</p><Link className="primary-action" to={`/login?returnTo=${encodeURIComponent(`/keys/rooms/${roomId}`)}`}>เข้าสู่ระบบมหาวิทยาลัย</Link><Link to="/keys">กลับไปเลือกห้อง</Link></section>
  if (result) return <section className="key-request-entry key-request-success"><span aria-hidden="true">✓</span><h1>{result.status === 'APPROVED' ? 'ส่งคำขอและอนุมัติแล้ว' : 'ส่งคำขอเรียบร้อยแล้ว'}</h1><p>รหัสคำขอ {result.request_code}</p><small>ระบบจะส่งอีเมลพร้อมลิงก์สำหรับดูสถานะ ยกเลิก และแจ้งคืนกุญแจ</small><Link to="/keys">กลับไปหน้าห้องปฏิบัติการ</Link></section>

  const requesterName = room.requiresSsoForKeyRequest ? identity?.fullName ?? '' : name
  const requesterEmail = room.requiresSsoForKeyRequest ? identity?.email ?? '' : email

  const requestInput = {
    roomId, requesterName, requesterEmail, purposeType, purpose,
    startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`,
    courseCode, courseName, lecturerName, lecturerEmail,
  }

  if (reviewing) return <section className="key-request-entry key-request-review"><header><span className="key-request-kicker">ขั้นตอนสุดท้าย</span><h1>ตรวจสอบข้อมูลคำขอ</h1><p>กรุณาตรวจสอบข้อมูลก่อนส่งคำขอ</p></header><dl><div><dt>ห้อง</dt><dd>{room.code} · {room.name}</dd></div><div><dt>ผู้ขอ</dt><dd>{requesterName}</dd></div><div><dt>อีเมล</dt><dd>{requesterEmail}</dd></div><div><dt>วันที่และเวลา</dt><dd>{date} · {startTime}–{endTime} น.</dd></div><div><dt>วัตถุประสงค์</dt><dd>{purpose}</dd></div></dl><div className="key-review-actions"><button type="button" onClick={() => setReviewing(false)}>ย้อนกลับไปแก้ไข</button><button className="primary-action" type="button" disabled={save.isPending} onClick={() => save.mutate(requestInput)}>{save.isPending ? 'กำลังส่งคำขอ…' : 'ยืนยันส่งคำขอ'}</button></div>{save.error && <p className="panel-error" role="alert">{save.error.message}</p>}</section>

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const startsAt = `${date}T${startTime}:00+07:00`
    const endsAt = `${date}T${endTime}:00+07:00`
    const ruleResult = validateKeyRequest({ email: requesterEmail, startsAt, endsAt })
    const nextErrors: Record<string, string> = { ...ruleResult.errors }
    if (!requesterName.trim()) nextErrors.name = 'กรุณากรอกชื่อ–นามสกุล'
    if (!purpose.trim()) nextErrors.purpose = 'กรุณาระบุวัตถุประสงค์'
    if (endTime <= startTime) nextErrors.time = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    if (purposeType === 'TEACHING') {
      if (!courseCode.trim()) nextErrors.courseCode = 'กรุณาระบุรหัสวิชา'
      if (!courseName.trim()) nextErrors.courseName = 'กรุณาระบุชื่อวิชา'
      if (!lecturerName.trim()) nextErrors.lecturerName = 'กรุณาระบุชื่ออาจารย์ผู้สอน'
      if (!/^[^\s@]+@northbkk\.ac\.th$/i.test(lecturerEmail.trim())) nextErrors.lecturerEmail = 'กรุณาใช้อีเมลอาจารย์ @northbkk.ac.th'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setReviewing(true)
  }

  return <section className="key-request-entry"><Link className="back-link" to="/keys">← กลับไปเลือกห้อง</Link><header><span className="key-request-kicker">{room.code} · {room.name}</span><h1>แบบฟอร์มเบิกกุญแจ</h1><p>{room.requiresSsoForKeyRequest ? 'คำขอนี้ต้องรอเจ้าหน้าที่อนุมัติ' : 'ห้องทั่วไปอนุมัติอัตโนมัติหลังตรวจสอบข้อมูล'}</p></header>
    <form className="key-request-form" onSubmit={submit} noValidate>
      <label>ชื่อ–นามสกุล<input required value={requesterName} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setName(event.target.value)} />{errors.name && <small role="alert">{errors.name}</small>}</label>
      <label>อีเมลมหาวิทยาลัย<input type="email" required placeholder="name@northbkk.ac.th" value={requesterEmail} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setEmail(event.target.value)} />{errors.email && <small role="alert">{errors.email}</small>}</label>
      <label>วัตถุประสงค์<select value={purposeType} onChange={(event) => setPurposeType(event.target.value as 'TEACHING' | 'OTHER')}><option value="OTHER">ใช้งานทั่วไป</option><option value="TEACHING">เปิดห้องเพื่อการเรียนการสอน</option></select></label>
      {purposeType === 'TEACHING' && <><label>รหัสวิชา<input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />{errors.courseCode && <small role="alert">{errors.courseCode}</small>}</label><label>ชื่อวิชา<input value={courseName} onChange={(event) => setCourseName(event.target.value)} />{errors.courseName && <small role="alert">{errors.courseName}</small>}</label><label>อาจารย์ผู้สอน<input value={lecturerName} onChange={(event) => setLecturerName(event.target.value)} />{errors.lecturerName && <small role="alert">{errors.lecturerName}</small>}</label><label>อีเมลอาจารย์ผู้สอน<input type="email" placeholder="lecturer@northbkk.ac.th" value={lecturerEmail} onChange={(event) => setLecturerEmail(event.target.value)} />{errors.lecturerEmail && <small role="alert">{errors.lecturerEmail}</small>}</label></>}
      <label className="key-purpose">รายละเอียดวัตถุประสงค์<textarea required rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} />{errors.purpose && <small role="alert">{errors.purpose}</small>}</label>
      <label>วันที่<input type="date" value={date} readOnly /></label>
      <div className="key-time-fields"><label>เวลาเริ่ม<select value={startTime} onChange={(event) => setStartTime(event.target.value)}>{TIME_OPTIONS.slice(0, -1).map((time) => <option key={time}>{time}</option>)}</select></label><label>เวลาคืน<select value={endTime} onChange={(event) => setEndTime(event.target.value)}>{TIME_OPTIONS.slice(1).map((time) => <option key={time}>{time}</option>)}</select></label></div>
      {(errors.date || errors.time || save.error) && <p className="panel-error" role="alert">{errors.date ?? errors.time ?? save.error?.message}</p>}
      <button className="primary-action">ตรวจสอบข้อมูล</button>
    </form>
  </section>
}
