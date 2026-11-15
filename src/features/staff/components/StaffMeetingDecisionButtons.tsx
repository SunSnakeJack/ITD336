import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { approveBooking, rejectBooking } from '../../bookings/booking.service'
import { bookingKeys } from '../../bookings/booking.queries'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { staffUsageQueryKey } from '../reporting/staff-usage.queries'
import type { StaffUsageRow } from '../reporting/staff-usage.types'
import { StaffKeyRequestDecisionDialog } from './StaffKeyRequestDecisionDialog'

export function StaffMeetingDecisionButtons({ row }: { row: StaffUsageRow }) {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const client = useQueryClient()
  const bookingId = row.transactionId.replace(/^booking:/, '')
  const save = useMutation({
    mutationFn: ({ choice, reason }: { choice: 'APPROVED' | 'REJECTED'; reason: string }) =>
      choice === 'APPROVED' ? approveBooking(bookingId, reason) : rejectBooking(bookingId, reason),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: staffUsageQueryKey }),
        client.invalidateQueries({ queryKey: bookingKeys.admin }),
        client.invalidateQueries({ queryKey: scheduleKeys.all }),
      ])
      setDecision(null)
    },
  })
  const open = (choice: 'APPROVED' | 'REJECTED') => {
    save.reset()
    setDecision(choice)
  }

  return <>
    <div className="staff-decision-actions">
      <button type="button" onClick={() => open('APPROVED')}>อนุมัติ</button>
      <button type="button" className="danger" onClick={() => open('REJECTED')}>ไม่อนุมัติ</button>
    </div>
    {decision && <StaffKeyRequestDecisionDialog requestCode={row.userName} roomCode={row.roomCode}
      decision={decision} pending={save.isPending}
      error={save.error ? (save.error.message.includes('ROOM_UNAVAILABLE')
        ? 'ช่วงเวลานี้มีการใช้งานห้องแล้ว' : 'ไม่สามารถบันทึกผลได้ กรุณาตรวจสอบสิทธิ์และสถานะรายการ') : undefined}
      onClose={() => { if (!save.isPending) setDecision(null) }}
      onConfirm={reason => save.mutate({ choice: decision, reason })} />}
  </>
}
