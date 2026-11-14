import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { bangkokDateKey, isSaturday } from '../../schedules/saturday-policy'
import { saturdayPolicyKey, saturdayPolicyQuery } from '../../schedules/saturday-policy.queries'
import { setOpenSaturday } from '../staff-settings.service'
import { StaffQueryState } from './StaffPage'

export function StaffSaturdaySetting() {
  const policy = useQuery(saturdayPolicyQuery())
  return <StaffQueryState loading={policy.isPending} error={policy.error}>
    <SaturdaySettingForm key={policy.data ?? 'closed'} initialDate={policy.data ?? null} />
  </StaffQueryState>
}

function SaturdaySettingForm({ initialDate }: { initialDate: string | null }) {
  const today = bangkokDateKey()
  const [enabled, setEnabled] = useState(Boolean(initialDate))
  const [date, setDate] = useState(initialDate ?? (isSaturday(today) ? today : ''))
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: setOpenSaturday,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: saturdayPolicyKey }) },
  })
  const selected = enabled ? date : null
  return <article className="staff-card staff-permission-setting">
    <div><h3>เปิดให้จองวันเสาร์ชั่วคราว</h3>
      <p>เปิดการจองและเบิกกุญแจเฉพาะวันที่เลือก สิ้นสุดเมื่อพ้นวันเสาร์ตามเวลาไทย</p>
      {enabled && <label>วันเสาร์ที่เปิด <input type="date" min={today} value={date} onChange={event => setDate(event.target.value)} /></label>}
      {enabled && date && !isSaturday(date) && <p role="alert">กรุณาเลือกวันที่ตรงกับวันเสาร์</p>}
    </div>
    <label className="staff-setting-switch"><input aria-label="เปิดให้จองวันเสาร์ชั่วคราว" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} /><span aria-hidden="true"/><b>{enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</b></label>
    <button className="staff-button" disabled={save.isPending || selected === initialDate || (enabled && (!isSaturday(date) || date < today))} onClick={() => save.mutate(selected)}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึกวันเสาร์'}</button>
    {save.isError && <p role="alert">บันทึกวันเสาร์ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และวันที่</p>}
  </article>
}
