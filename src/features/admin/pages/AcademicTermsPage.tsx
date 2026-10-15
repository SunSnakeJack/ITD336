import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { academicTermsQuery, termKeys } from '../../terms/term.queries'
import { saveAcademicTerm } from '../../terms/term.service'
import type { AcademicTerm, AcademicTermInput } from '../../terms/term.types'

const emptyTerm = (): AcademicTermInput => ({ academicYear: String(new Date().getFullYear() + 543), termCode: '1', startsOn: '', endsOn: '', active: true })

export function AcademicTermsPage() {
  const client = useQueryClient()
  const terms = useQuery(academicTermsQuery())
  const [form, setForm] = useState<AcademicTermInput | null>(null)
  const save = useMutation({ mutationFn: saveAcademicTerm, onSuccess: async () => { await client.invalidateQueries({ queryKey: termKeys.all }); setForm(null) } })
  const edit = (term: AcademicTerm) => setForm({ ...term })
  return <section className="content-page"><div className="page-heading"><div><span>TERM SETTINGS</span><h1>ตั้งค่าภาคเรียน</h1><p>กำหนดช่วงวันที่สำหรับตารางเรียนที่เกิดซ้ำตลอดภาคเรียน</p></div><button className="primary-action" onClick={() => setForm(emptyTerm())}>เพิ่มภาคเรียน</button></div>
    {(terms.error || save.error) && <p className="panel-error">{(terms.error || save.error)?.message}</p>}
    {form && <form className="term-form" onSubmit={(event) => { event.preventDefault(); save.mutate(form) }}>
      <label>ปีการศึกษา<input required value={form.academicYear} onChange={(event) => setForm({ ...form, academicYear: event.target.value })} /></label>
      <label>ภาคเรียน<input required value={form.termCode} onChange={(event) => setForm({ ...form, termCode: event.target.value })} /></label>
      <label>วันที่เริ่มต้น<input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></label>
      <label>วันที่สิ้นสุด<input required type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></label>
      <label className="term-active"><input checked={form.active} type="checkbox" onChange={(event) => setForm({ ...form, active: event.target.checked })} /> เปิดใช้งาน</label>
      <div className="form-actions"><button type="button" onClick={() => setForm(null)}>ยกเลิก</button><button className="primary-action" disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึกภาคเรียน'}</button></div>
    </form>}
    <div className="data-table"><div className="table-row term-table table-head"><span>ปีการศึกษา / ภาคเรียน</span><span>วันที่เริ่มต้น</span><span>วันที่สิ้นสุด</span><span>สถานะ</span><span>จัดการ</span></div>{terms.data?.map((term) => <div className="table-row term-table" key={term.id}><span><strong>{term.academicYear} / {term.termCode}</strong></span><span>{term.startsOn}</span><span>{term.endsOn}</span><span><i className={term.active ? 'status active' : 'status'}>{term.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</i></span><span><button onClick={() => edit(term)}>แก้ไข</button></span></div>)}</div>
  </section>
}
