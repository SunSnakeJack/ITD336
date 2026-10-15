import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleKeys } from '../schedule.queries'
import { saveAcademicSchedule } from '../schedule.service'
import type { AcademicScheduleInput } from '../schedule.types'

function nextHour(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return `${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function CellScheduleForm({ roomId, date, time, onClose }: { roomId: string; date: string; time: string; onClose: () => void }) {
  const client = useQueryClient()
  const [form, setForm] = useState<AcademicScheduleInput>(() => ({
    roomId, courseCode: '', courseName: '', academicYear: String(new Date().getFullYear() + 543), semester: '1', teacherId: null,
    dayOfWeek: new Date(`${date}T12:00:00`).getDay(), startTime: time, endTime: nextHour(time), effectiveFrom: date, effectiveUntil: date, active: true,
  }))
  const save = useMutation({ mutationFn: saveAcademicSchedule, onSuccess: async () => { await client.invalidateQueries({ queryKey: scheduleKeys.all }); onClose() } })
  return <div className="schedule-dialog-backdrop" role="presentation"><form className="schedule-dialog" aria-label="เพิ่มข้อมูลตารางเรียน" onSubmit={(event) => { event.preventDefault(); save.mutate(form) }}>
    <header><div><h2>เพิ่มข้อมูลตารางเรียน</h2><p>{date} · {form.startTime}</p></div><button aria-label="ปิด" type="button" onClick={onClose}>×</button></header>
    <label>รหัสวิชา<input autoFocus required value={form.courseCode} onChange={(event) => setForm({ ...form, courseCode: event.target.value })} /></label>
    <label>ชื่อวิชา<input required value={form.courseName} onChange={(event) => setForm({ ...form, courseName: event.target.value })} /></label>
    <label>เวลาเริ่ม<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label>
    <label>เวลาสิ้นสุด<input required type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label>
    <label>ปีการศึกษา<input required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label>
    <label>ภาคเรียน<input required value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} /></label>
    {save.error && <p className="panel-error">{save.error.message}</p>}
    <div className="form-actions"><button type="button" onClick={onClose}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
  </form></div>
}
