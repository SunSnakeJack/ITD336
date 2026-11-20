import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { setShowElapsedRoomSlots, showElapsedRoomSlotsQuery } from '../../schedules/schedule-display.queries'
import { StaffQueryState } from './StaffPage'

export function StaffScheduleDisplaySettings() {
  const options = showElapsedRoomSlotsQuery()
  const setting = useQuery(options)
  const client = useQueryClient()
  const save = useMutation({
    mutationFn: setShowElapsedRoomSlots,
    onSuccess: show => client.setQueryData(options.queryKey, show),
  })
  return <section className="staff-card grid gap-3 mt-4">
    <h3>ตารางการใช้งานห้อง</h3>
    <StaffQueryState loading={setting.isPending} error={setting.error}>
      <label className="flex items-center gap-2">
        <input type="checkbox" role="switch" checked={save.isPending ? save.variables : setting.data ?? true}
          disabled={save.isPending} onChange={event => save.mutate(event.target.checked)} />
        แสดงเวลาที่ผ่านมาแล้ว
      </label>
      {save.isError && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">บันทึกการแสดงผลตารางแล้ว</p>}
    </StaffQueryState>
  </section>
}
