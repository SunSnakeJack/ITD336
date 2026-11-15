import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meetingBookingPolicyKey } from '../../meeting-rooms/meeting-booking-policy'
import { meetingAdvanceBookingDaysQuery } from '../staff-settings.queries'
import { setMeetingAdvanceBookingDays } from '../staff-settings.service'
import { StaffQueryState } from './StaffPage'
import { SelectField } from '../../../shared/components/SelectField'

const dayOptions = Array.from({ length: 30 }, (_, index) => ({
  value: String(index + 1), label: `${index + 1} วัน`,
}))

export function StaffMeetingAdvanceBookingSetting() {
  const query = meetingAdvanceBookingDaysQuery()
  const setting = useQuery(query)
  const client = useQueryClient()
  const [draft, setDraft] = useState<number>()
  const save = useMutation({
    mutationFn: setMeetingAdvanceBookingDays,
    onSuccess: async (days) => {
      client.setQueryData(query.queryKey, days)
      setDraft(undefined)
      await client.invalidateQueries({ queryKey: meetingBookingPolicyKey })
    },
  })
  const selected = draft ?? setting.data

  return <StaffQueryState loading={setting.isPending} error={setting.error} empty={selected === undefined}>
    <article className="staff-card staff-permission-setting">
      <div>
        <h3>ระยะเวลาจองห้องประชุมล่วงหน้า</h3>
        <p>เริ่มนับจากวันพรุ่งนี้ตามเวลาไทย โดยข้ามวันเสาร์ที่ปิดให้จอง</p>
      </div>
      <div className="staff-field">
        <SelectField label="จำนวนวันจองล่วงหน้า" value={String(selected ?? '')}
          placeholder="เลือกจำนวนวัน" options={dayOptions} disabled={save.isPending} onChange={days => {
          setDraft(Number(days))
          save.reset()
        }} />
      </div>
      <button type="button" className="staff-button"
        disabled={save.isPending || selected === setting.data}
        onClick={() => { if (selected !== undefined) save.mutate(selected) }}>
        {save.isPending ? 'กำลังบันทึก…' : 'บันทึกระยะเวลาจอง'}
      </button>
      {save.isSuccess && <p className="staff-setting-success" role="status">บันทึกระยะเวลาจองแล้ว</p>}
      {save.isError && <p className="staff-role-error" role="alert">บันทึกระยะเวลาจองไม่สำเร็จ กรุณาลองอีกครั้ง</p>}
    </article>
  </StaffQueryState>
}
