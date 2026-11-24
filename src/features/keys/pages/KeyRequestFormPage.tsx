import { keyCatalogPath } from '../utils/key-catalog-path'
import { RequestStepper } from '../../../shared/components/RequestStepper'
import { saturdayPolicyQuery } from '../../schedules/saturday-policy.queries'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { getRequesterStatus, ROLE_LABELS, type AuthIdentity } from '../../auth/auth.types'
import { publicRoomsQuery, publicScheduleEventsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { createKeyRequest, KeyRequestOperatingHoursError } from '../key.service'
import type { KeyRequestResult } from '../key.types'
import { validateKeyRequest } from '../utils/key-request-rules'
import { keyLoanKeys, keyRequestReferenceOptionsQuery } from '../key.queries'
import { RequesterStatusSelect } from '../components/RequesterStatusSelect'
import { KeyRequestReview } from '../components/KeyRequestReview'
import { KeyRequestSuccess } from '../components/KeyRequestSuccess'
import { LecturerCombobox } from '../components/LecturerCombobox'
import { SelectField } from '../../../shared/components/SelectField'
import { availableEndTimes, timeSelectOptions } from '../../schedules/request-time-options'
import { DEFAULT_KEY_HOURS, isKeySlotElapsed, keySlotTimes, keySlotOccupied } from '../utils/key-catalog-time'
import { formatThaiDate } from '../utils/format-thai-date'
import './KeyRequestFormPage.css'
import { useTabDraft } from '../../../shared/components/useTabDraft'
import { rememberPublicMenu } from '../../public/public-navigation-memory'

interface KeyDraft {
  appliedSelection?: string
  replacementDate?: string
  name?: string
  email?: string
  guestStatus: 'STUDENT' | 'TEACHER'
  purposeType: 'TEACHING' | 'OTHER' | null
  purpose: string
  courseCode: string
  referenceOptionId: string
  selectedStart: string
  selectedEnd: string
  reviewing: boolean
}

function bangkokDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function KeyRequestFormPage({ identity, authLoading }: { identity: AuthIdentity | null; authLoading: boolean }) {
  const queryClient = useQueryClient()
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const rooms = useQuery(publicRoomsQuery())
  const saturday = useQuery(saturdayPolicyQuery())
  const referenceOptions = useQuery(keyRequestReferenceOptionsQuery(identity?.userId))
  const room = rooms.data?.find((item) => item.id === roomId)
  const requestedDate = useMemo(() => searchParams.get('date') ?? bangkokDate(), [searchParams])
  const scope = identity?.userId ?? 'guest'
  const [draft, updateDraft, clearDraft] = useTabDraft<KeyDraft>(`draft:key:${scope}:${roomId}:${requestedDate}`, {
    guestStatus: 'STUDENT', purposeType: null, purpose: '', courseCode: '', referenceOptionId: '',
    selectedStart: searchParams.get('start') ?? '08:00', selectedEnd: searchParams.get('end') ?? '09:00', reviewing: false,
  })
  const selection = searchParams.get('selection')
  const incomingStart = searchParams.get('start')
  const incomingEnd = searchParams.get('end')
  if (!authLoading && selection && incomingStart && incomingEnd && draft.appliedSelection !== selection) {
    // Consume each explicit room selection once so reopening this URL restores subsequent form edits.
    updateDraft({ appliedSelection: selection, replacementDate: undefined, selectedStart: incomingStart, selectedEnd: incomingEnd, reviewing: false })
  }
  const date = draft.replacementDate ?? requestedDate
  const resetToToday = () => updateDraft({ replacementDate: bangkokDate(), selectedStart: '', selectedEnd: '', reviewing: false })
  const { guestStatus, purposeType, purpose, courseCode, referenceOptionId, selectedStart, selectedEnd, reviewing } = draft
  const setRequesterField = (field: 'name' | 'email', value: string) => updateDraft({ [field]: value })
  const setGuestStatus = (value: KeyDraft['guestStatus']) => updateDraft({ guestStatus: value })
  const setPurposeType = (value: KeyDraft['purposeType']) => updateDraft({ purposeType: value })
  const setPurpose = (value: string) => updateDraft({ purpose: value })
  const setCourseCode = (value: string) => updateDraft({ courseCode: value })
  const setReferenceOptionId = (value: string) => updateDraft({ referenceOptionId: value })
  const setStartTime = (value: string) => updateDraft({ selectedStart: value, selectedEnd: '' })
  const setEndTime = (value: string) => updateDraft({ selectedEnd: value })
  const setReviewing = (value: boolean) => updateDraft({ reviewing: value })
  const accountStatus = getRequesterStatus(identity)
  const requesterType = accountStatus ?? guestStatus
  const displayRole = identity?.role ?? requesterType
  const events = useQuery({ ...publicScheduleEventsQuery({ roomId, from: date, to: date }), enabled: Boolean(roomId && room && (!room.requiresLoginForKeyRequest || identity)) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<KeyRequestResult | null>(null)
  const save = useMutation({ mutationFn: createKeyRequest, onError: (error) => {
    if (error instanceof KeyRequestOperatingHoursError) {
      setErrors({ time: error.message })
      setReviewing(false)
      void rooms.refetch()
    }
  }, onSuccess: async (created) => {
    clearDraft()
    rememberPublicMenu(scope, '/keys', keyCatalogPath(room?.requiresSsoForKeyRequest))
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
      queryClient.invalidateQueries({ queryKey: keyLoanKeys.all }),
    ])
    setResult(created)
  } })

  if (authLoading) return <LoadingSpinner label="กำลังตรวจสอบบัญชี…" />
  if (rooms.isPending) return <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" />
  if (rooms.isError) return <section className="key-request-entry" role="alert">ไม่สามารถโหลดข้อมูลห้องได้ <button type="button" onClick={() => void rooms.refetch()}>ลองใหม่</button></section>
  if (!room || room.usageScope && room.usageScope !== 'LABORATORY') return <Navigate to="/keys" replace />
  if (room.requiresLoginForKeyRequest && !identity) return <section className="key-request-entry key-auth-required"><h1>ห้องนี้ต้องเข้าสู่ระบบ</h1><p>กรุณายืนยันตัวตนด้วยบัญชีมหาวิทยาลัยก่อนส่งคำขอ</p><Link className="primary-action" to={`/login?returnTo=${encodeURIComponent(`/keys/rooms/${roomId}/request${searchParams.size ? `?${searchParams.toString()}` : ''}`)}`}>เข้าสู่ระบบมหาวิทยาลัย</Link><Link to={`/keys/rooms/${roomId}`}>กลับไปดูรายละเอียดห้อง</Link></section>
  const requesterName = (room.requiresSsoForKeyRequest ? undefined : draft?.name) ?? identity?.fullName ?? ''
  const requesterEmail = (room.requiresSsoForKeyRequest ? undefined : draft?.email) ?? identity?.email ?? ''
  const effectivePurpose = purposeType === 'TEACHING' ? 'เปิดห้องเพื่อการเรียนการสอน' : purpose
  const selectedReference = referenceOptions.data?.find((option) => option.id === referenceOptionId)
  const courseRequired = purposeType === 'TEACHING'

  const now = new Date()
  const hours = room.keyOperatingHours ?? DEFAULT_KEY_HOURS
  const slots = keySlotTimes(hours)
  const startOptions = timeSelectOptions(
    slots.slice(0, -1).filter(time => !isKeySlotElapsed(date, time, slots, now)),
    (time) => keySlotOccupied(date, time, slots, events.data ?? []),
  )
  const startTime = reviewing || result ? selectedStart
    : startOptions.find((option) => option.value === selectedStart && !option.disabled)?.value ?? ''
  const endOptions = timeSelectOptions(availableEndTimes(slots, startTime, (time) =>
    keySlotOccupied(date, time, slots, events.data ?? []),
  ))
  const endTime = reviewing || result || endOptions.some((option) => option.value === selectedEnd) ? selectedEnd : ''
  const customHours = hours.opensAt !== DEFAULT_KEY_HOURS.opensAt || hours.closesAt !== DEFAULT_KEY_HOURS.closesAt
  const selectionUnavailable = Boolean((draft.appliedSelection || customHours) && events.isSuccess && (
    (selectedStart && !startTime) || (selectedEnd && !endTime)
  ))
  if (result) return <KeyRequestSuccess catalogPath={keyCatalogPath(room.requiresSsoForKeyRequest)} status={result.status} roomCode={room.code} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} />

  const requestInput = {
    roomId, requesterName, requesterEmail, purposeType: purposeType ?? 'OTHER', purpose: effectivePurpose,
    startsAt: `${date}T${startTime}:00+07:00`, endsAt: `${date}T${endTime}:00+07:00`,
    courseCode: courseRequired ? courseCode.trim() : undefined,
    requesterType, referenceOptionId: courseRequired && requesterType === 'STUDENT' ? referenceOptionId || undefined : undefined,
  }

  const confirm = async () => {
    const [latest, latestRooms] = await Promise.all([events.refetch(), rooms.refetch()])
    const latestRoom = latestRooms.data?.find(item => item.id === roomId)
    const latestSlots = keySlotTimes(latestRoom?.keyOperatingHours)
    const occupied = (time: string) => keySlotOccupied(date, time, latestSlots, latest.data ?? [])
    const valid = latest.isSuccess && latestRooms.isSuccess && latestRoom?.active
      && !isKeySlotElapsed(date, startTime, latestSlots, new Date())
      && availableEndTimes(latestSlots, startTime, occupied).includes(endTime)
    if (!valid) {
      setErrors({ time: latest.isError || latestRooms.isError ? 'ไม่สามารถตรวจสอบช่วงเวลาว่างได้ กรุณาลองใหม่' : 'ช่วงเวลาที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกเวลาใหม่' })
      if (date < bangkokDate()) resetToToday()
      else setReviewing(false)
      return
    }
    save.mutate(requestInput)
  }

  if (reviewing) return <KeyRequestReview roomCode={room.code} requesterName={requesterName} requesterEmail={requesterEmail} requesterStatus={ROLE_LABELS[displayRole]} date={date} startTime={startTime} endTime={endTime} purpose={effectivePurpose} courseCode={courseRequired ? courseCode.trim() : undefined} lecturerName={courseRequired && requesterType === 'STUDENT' ? selectedReference?.lecturerName : undefined} submitting={save.isPending || events.isFetching || rooms.isFetching} error={save.error?.message} onBack={() => setReviewing(false)} onConfirm={() => void confirm()} />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const startsAt = `${date}T${startTime}:00+07:00`
    const endsAt = `${date}T${endTime}:00+07:00`
    const ruleResult = validateKeyRequest({ email: requesterEmail, startsAt, endsAt, openSaturday: saturday.data, hours })
    const nextErrors: Record<string, string> = { ...ruleResult.errors }
    if (!requesterName.trim()) nextErrors.name = 'กรุณากรอกชื่อ–นามสกุล'
    if (!purposeType) nextErrors.purposeType = 'กรุณาเลือกวัตถุประสงค์'
    if (purposeType === 'OTHER' && !purpose.trim()) nextErrors.purpose = 'กรุณาระบุวัตถุประสงค์'
    if (!events.isSuccess) nextErrors.time = 'ไม่สามารถตรวจสอบช่วงเวลาว่างได้'
    else if (!startTime || !endTime || endTime <= startTime) nextErrors.time = 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น'
    if (courseRequired) {
      if (!courseCode.trim()) nextErrors.courseCode = 'กรุณากรอกรหัสวิชา'
      if (requesterType === 'STUDENT' && !selectedReference) {
        nextErrors.referenceOptionId = 'กรุณาเลือกอาจารย์ผู้สอน'
      }
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    setReviewing(true)
  }

  return <section className="key-request-entry key-booking-form-page"><Link className="back-link" to={keyCatalogPath(room.requiresSsoForKeyRequest)}>‹ กลับหน้าหลัก</Link><header><h1>แบบฟอร์มการเบิกกุญแจ</h1><p>กรุณากรอกข้อมูลเพื่อดำเนินการเบิกกุญแจ</p></header><RequestStepper step={1} label="ขั้นตอนการเบิกกุญแจ" />
    <form className="key-request-form" onSubmit={submit} noValidate>
      <section className="key-form-section" aria-labelledby="requester-heading"><h2 className="key-section-heading" id="requester-heading"><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>ข้อมูลผู้เบิกกุญแจ</span></h2><div className="key-identity-row">{identity?.role || accountStatus ? <label>สถานะ<input readOnly value={ROLE_LABELS[displayRole]}/></label> : <RequesterStatusSelect value={requesterType} onChange={setGuestStatus}/>}<label>ชื่อ–นามสกุล<input aria-label="ชื่อ–นามสกุล" required placeholder="กรุณากรอกชื่อ–นามสกุล" value={requesterName} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setRequesterField('name', event.target.value)} />{errors.name && <small role="alert">{errors.name}</small>}</label></div>
      <label>อีเมล<input aria-label="อีเมล" type="email" required placeholder="name@northbkk.ac.th" value={requesterEmail} readOnly={Boolean(room.requiresSsoForKeyRequest)} onChange={(event) => setRequesterField('email', event.target.value)} />{errors.email && <small role="alert">{errors.email}</small>}</label></section>
      <fieldset className="key-purpose-options" aria-labelledby="key-purpose-heading"><h2 id="key-purpose-heading" className="key-section-heading key-purpose-heading"><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 12h6"/><path d="M9 16h6"/></svg><span>วัตถุประสงค์</span></h2><label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='TEACHING'} onChange={()=>setPurposeType('TEACHING')}/><span>เพื่อเปิดห้องการเรียนการสอน</span></label>{courseRequired && <div className="key-purpose-fields">
          <div className="key-purpose-row"><label htmlFor="course-code-input">รหัสวิชา</label><div className="key-purpose-input-wrap"><input id="course-code-input" aria-label="รหัสวิชา" placeholder="กรุณากรอกรหัสวิชา" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />{errors.courseCode && <small role="alert">{errors.courseCode}</small>}</div></div>
          {requesterType === 'STUDENT' && <div className="key-purpose-select-row"><LecturerCombobox value={referenceOptionId} options={referenceOptions.data ?? []} onChange={setReferenceOptionId} loading={referenceOptions.isPending} error={referenceOptions.isError ? 'ไม่สามารถโหลดรายชื่ออาจารย์ได้' : errors.referenceOptionId}/></div>}
        </div>}<label className="key-purpose-choice"><input type="radio" name="purposeType" checked={purposeType==='OTHER'} onChange={()=>setPurposeType('OTHER')}/><span>อื่นๆ</span></label>
      {purposeType === 'OTHER' && <div className="key-other-purpose-fields"><div className="key-other-purpose-field"><label htmlFor="other-purpose-input">ระบุวัตถุประสงค์ *</label><textarea id="other-purpose-input" aria-label="ระบุวัตถุประสงค์" required rows={2} placeholder="กรุณาระบุ เช่น ประชุมโครงงาน หรือจัดกิจกรรม" value={purpose} onChange={(event) => setPurpose(event.target.value)} />{errors.purpose && <small role="alert">{errors.purpose}</small>}</div></div>}{errors.purposeType&&<small role="alert">{errors.purposeType}</small>}</fieldset>
      <section className="key-form-section key-date-time-section" aria-labelledby="date-time-heading"><h2 className="key-section-heading" id="date-time-heading"><svg className="key-section-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>เวลาที่เบิกกุญแจ</span></h2>
      <label>วันที่เบิก<input readOnly value={Number.isFinite(Date.parse(date)) ? formatThaiDate(date) : ''}/></label>
      {date < bangkokDate() && <button type="button" onClick={resetToToday}>เลือกเวลาของวันนี้</button>}
      <div className="key-time-fields key-time-row"><SelectField label="เวลาเริ่มต้น" value={startTime} placeholder="เลือกเวลาเริ่มต้น" options={startOptions} onChange={setStartTime} placement="top"/><SelectField label="เวลาสิ้นสุด" value={endTime} placeholder="เลือกเวลาสิ้นสุด" options={endOptions} disabled={!startTime} onChange={setEndTime} placement="top"/></div></section>
      {(errors.date || errors.time || save.error) && <p className="panel-error" role="alert">{errors.date ?? errors.time ?? save.error?.message}</p>}
      {selectionUnavailable && !errors.date && !errors.time && !save.error && <p className="panel-error" role="alert">ช่วงเวลาที่เลือกใช้ไม่ได้แล้ว กรุณาเลือกเวลาใหม่</p>}
      {events.isPending && <p role="status">กำลังตรวจสอบช่วงเวลาว่าง…</p>}
      <div className="key-form-actions"><Link to={`/keys/rooms/${roomId}`}>ย้อนกลับ</Link><button className="primary-action" disabled={events.isPending}>ถัดไป <span aria-hidden="true">→</span></button></div>
    </form>
  </section>
}
