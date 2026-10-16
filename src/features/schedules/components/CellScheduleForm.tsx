import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { academicTermsQuery } from '../../terms/term.queries'
import type { AcademicTerm } from '../../terms/term.types'
import { academicSchedulesQuery, scheduleKeys } from '../schedule.queries'
import { deactivateAcademicSchedule, saveAcademicSchedule } from '../schedule.service'
import type { AcademicSchedule, AcademicScheduleInput } from '../schedule.types'
import { SCHEDULE_TIMES } from './WeeklySchedule'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

const END_TIMES = [...SCHEDULE_TIMES.slice(1), '18:30']
const CUSTOM_RANGE = 'CUSTOM_RANGE'

function Editor({ roomId, date, time, schedule, terms, onClose }: { roomId: string; date: string; time: string; schedule?: AcademicSchedule; terms: AcademicTerm[]; onClose: () => void }) {
  const client = useQueryClient()
  const initialTerm = terms.find((term) => term.academicYear === schedule?.academicYear && term.termCode === schedule.semester) ?? terms.find((term) => term.active)
  const [termId, setTermId] = useState(initialTerm?.id ?? (schedule ? CUSTOM_RANGE : ''))
  const [form, setForm] = useState<AcademicScheduleInput>(() => schedule ? {
    id: schedule.id, roomId: schedule.roomId, courseCode: schedule.courseCode, courseName: schedule.courseName, academicYear: schedule.academicYear,
    semester: schedule.semester, teacherId: schedule.teacherId, dayOfWeek: schedule.dayOfWeek, startTime: schedule.startTime.slice(0, 5), endTime: schedule.endTime.slice(0, 5), effectiveFrom: schedule.effectiveFrom, effectiveUntil: schedule.effectiveUntil, active: schedule.active,
  } : {
    roomId, courseCode: '', courseName: '', academicYear: initialTerm?.academicYear ?? '', semester: initialTerm?.termCode ?? '', teacherId: null,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(), startTime: time, endTime: END_TIMES.find((value) => value > time) ?? '18:30', effectiveFrom: initialTerm?.startsOn ?? '', effectiveUntil: initialTerm?.endsOn ?? '', active: true,
  })
  const save = useMutation({ mutationFn: saveAcademicSchedule, onSuccess: async () => { await client.invalidateQueries({ queryKey: scheduleKeys.all }); onClose() } })
  const remove = useMutation({ mutationFn: (id: string) => deactivateAcademicSchedule(id), onSuccess: async () => { await client.invalidateQueries({ queryKey: scheduleKeys.all }); onClose() } })
  const chooseTerm = (id: string) => {
    const term = terms.find((item) => item.id === id)
    setTermId(id)
    if (term) setForm({ ...form, academicYear: term.academicYear, semester: term.termCode, effectiveFrom: term.startsOn, effectiveUntil: term.endsOn })
    else if (id === CUSTOM_RANGE && !form.academicYear) setForm({ ...form, academicYear: String(new Date().getFullYear() + 543), semester: '' })
  }
  const endOptions = END_TIMES.filter((value) => value > form.startTime)
  return <div className="schedule-dialog-backdrop" role="presentation"><form className="schedule-dialog" aria-label={schedule ? 'แก้ไขข้อมูลตารางเรียน' : 'เพิ่มข้อมูลตารางเรียน'} onSubmit={(event) => { event.preventDefault(); save.mutate(form) }}>
    <header><div><h2>{schedule ? 'แก้ไขข้อมูลตารางเรียน' : 'เพิ่มข้อมูลตารางเรียน'}</h2><p>{schedule ? 'การแก้ไขมีผลกับรายการตลอดภาคเรียน' : `${date} · ${time}`}</p></div><button aria-label="ปิด" type="button" onClick={onClose}>×</button></header>
    <label>รหัสวิชา<input autoFocus required value={form.courseCode} onChange={(event) => setForm({ ...form, courseCode: event.target.value })} /></label>
    <label>ชื่อวิชา<input required value={form.courseName} onChange={(event) => setForm({ ...form, courseName: event.target.value })} /></label>
    <label>เวลาเริ่ม<select required value={form.startTime} onChange={(event) => { const startTime = event.target.value; setForm({ ...form, startTime, endTime: END_TIMES.find((value) => value > startTime) ?? '18:30' }) }}>{SCHEDULE_TIMES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>เวลาสิ้นสุด<select required value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })}>{endOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label className="term-picker">ภาคเรียน<select required value={termId} onChange={(event) => chooseTerm(event.target.value)}><option value="">เลือกภาคเรียน</option>{terms.filter((term) => term.active || term.id === termId).map((term) => <option value={term.id} key={term.id}>{term.academicYear} / {term.termCode} · {term.startsOn}–{term.endsOn}</option>)}<option value={CUSTOM_RANGE}>กำหนดช่วงเวลาการสอนเอง</option></select></label>
    {termId === CUSTOM_RANGE && <div className="custom-range-fields"><label>ปีการศึกษา<input required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label><label>ภาคเรียน<input required value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} /></label><label>วันที่เริ่มต้น<input required type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label><label>วันที่สิ้นสุด<input required type="date" min={form.effectiveFrom} value={form.effectiveUntil} onChange={(event) => setForm({ ...form, effectiveUntil: event.target.value })} /></label></div>}
    {(save.error || remove.error) && <p className="panel-error">{(save.error || remove.error)?.message}</p>}
    <div className="form-actions">{schedule && <button className="danger-action" type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(`ยืนยันการลบตารางเรียน ${schedule.courseCode}?`)) remove.mutate(schedule.id) }}>{remove.isPending ? 'กำลังลบ…' : 'ลบตารางเรียน'}</button>}<span /><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={save.isPending || remove.isPending || !termId}>{save.isPending ? 'กำลังบันทึก…' : schedule ? 'บันทึกการแก้ไข' : 'เพิ่มตารางเรียน'}</button></div>
  </form></div>
}

export function CellScheduleForm({ roomId, date, time, scheduleId, onClose }: { roomId: string; date: string; time: string; scheduleId?: string; onClose: () => void }) {
  const terms = useQuery(academicTermsQuery())
  const schedules = useQuery({ ...academicSchedulesQuery(), enabled: Boolean(scheduleId) })
  if (terms.isPending || (scheduleId && schedules.isPending)) return <div className="schedule-dialog-backdrop"><div className="schedule-dialog-loading"><LoadingSpinner compact label="กำลังโหลดข้อมูล…" /></div></div>
  const schedule = scheduleId ? schedules.data?.find((item) => item.id === scheduleId) : undefined
  if (terms.error || schedules.error || (scheduleId && !schedule)) return <div className="schedule-dialog-backdrop"><div className="schedule-dialog-loading"><p className="panel-error">ไม่สามารถโหลดข้อมูลตารางหรือภาคเรียนได้</p><button onClick={onClose}>ปิด</button></div></div>
  return <Editor roomId={roomId} date={date} time={time} schedule={schedule} terms={terms.data ?? []} onClose={onClose} />
}
