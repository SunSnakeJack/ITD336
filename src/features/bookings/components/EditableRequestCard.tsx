import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase/client'
import { SelectField } from '../../../shared/components/SelectField'
import { keyLoanKeys } from '../../keys/key.queries'
import { bangkokClock } from '../../keys/utils/key-catalog-time'
import { meetingTimeOptions } from '../../meeting-rooms/utils/meeting-time-options'
import { scheduleKeys } from '../../schedules/schedule.queries'
import { availableEndTimes, timeSelectOptions, isRoomSlotOccupied } from '../../schedules/request-time-options'
import { bookingKeys } from '../booking.queries'
import { AccountRequestAction, AccountRequestCard } from './AccountRequestCard'
import type { ComponentProps } from 'react'

type EditTimes = {
  date: string
  opensAt: string
  closesAt: string
  slotMinutes?: number
  intervals: { startsAt: string; endsAt: string }[]
}

async function getEditTimes(id: string, type: string): Promise<EditTimes> {
  const { error, data } = await supabase.rpc('get_own_request_edit_times' as never, {
    p_id: id, p_type: type,
  } as never)
  if (error) throw new Error(error.message)
  return data as EditTimes
}

export function EditableRequestCard({ id, type, start, end, purpose, editable, purposeEditable = true, ...card }: Omit<
  ComponentProps<typeof AccountRequestCard>, 'edit' | 'purpose'
> & {
  id: string; type: 'booking' | 'key_request'; start: string; end: string; purpose: string;
  editable: boolean; purposeEditable?: boolean;
}) {
  const [params] = useSearchParams()
  const [draft, setDraft] = useState<{ start: string; end: string; purpose: string } | null>(() =>
    editable && params.get('edit') === id ? { start: bangkokClock(start), end: bangkokClock(end), purpose } : null)
  const editing = editable && draft !== null
  const client = useQueryClient()
  const availability = useQuery({
    queryKey: ['account-request-edit-times', type, id],
    queryFn: () => getEditTimes(id, type),
    enabled: editing,
    retry: false,
  })
  const context = availability.data
  const times = context ? meetingTimeOptions(context.date, new Date(), context.opensAt, context.closesAt, context.slotMinutes) : []
  const unavailable = (time: string) => Boolean(context && isRoomSlotOccupied(context.date, time, times, context.intervals))
  const starts = timeSelectOptions(times.slice(0, -1), unavailable)
  const selectedStart = starts.find(option => option.value === draft?.start && !option.disabled)?.value ?? ''
  const ends = timeSelectOptions(availableEndTimes(times, selectedStart, unavailable))
  const selectedEnd = ends.find(option => option.value === draft?.end)?.value ?? ''
  const keepOriginalTimes = draft?.start === bangkokClock(start) && draft?.end === bangkokClock(end)
  const canSavePurposeOnly = keepOriginalTimes && purposeEditable && draft?.purpose.trim() !== purpose.trim()
  const save = useMutation({
    mutationFn: async ({ startsAt, endsAt, purpose }: { startsAt: string; endsAt: string; purpose: string }) => {
      const { error } = await supabase.rpc('reschedule_own_request' as never, {
        p_id: id, p_type: type, p_start: startsAt, p_end: endsAt, p_purpose: purpose,
      } as never)
      if (error) throw new Error(error.message)
    },
    onSuccess: async () => {
      setDraft(null)
      await Promise.all([
        client.invalidateQueries({ queryKey: type === 'booking' ? bookingKeys.mine : keyLoanKeys.mine }),
        client.invalidateQueries({ queryKey: scheduleKeys.all }),
        client.invalidateQueries({ queryKey: ['account-request-edit-times'] }),
      ])
    },
  })
  const edit = editable && <button type="button" className="request-edit-toggle" aria-label="แก้ไขรายละเอียด"
    aria-expanded={editing} disabled={save.isPending} onClick={() => {
      save.reset()
      setDraft(editing ? null : { start: bangkokClock(start), end: bangkokClock(end), purpose })
    }}>
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="m4 16-1 5 5-1L21 7l-4-4ZM14 6l4 4" />
    </svg>
  </button>

  return <AccountRequestCard {...card} edit={edit} editing={editing}
    time={editing && draft ? <div className="account-request-edit-times">
      <SelectField label="เวลาเริ่มต้น" value={selectedStart} placeholder="กรุณาเลือก" options={starts}
        disabled={!context || save.isPending} onChange={start => setDraft({ ...draft, start, end: '' })}/>
      <SelectField label="เวลาสิ้นสุด" value={selectedEnd} placeholder="กรุณาเลือก" options={ends}
        disabled={!ends.length || save.isPending} onChange={end => setDraft({ ...draft, end })}/>
      {availability.isPending && <small role="status">กำลังโหลดช่วงเวลา…</small>}
      {availability.isError && <small role="alert">โหลดช่วงเวลาไม่สำเร็จ</small>}
      {context && keepOriginalTimes && !selectedEnd && <small>เวลาเดิม {draft.start}–{draft.end} น. หากเปลี่ยนเวลา กรุณาเลือกช่วงใหม่</small>}
    </div> : card.time}
    purpose={editing && draft && purposeEditable ? <textarea rows={2} aria-label="วัตถุประสงค์"
      disabled={save.isPending} value={draft.purpose} onChange={event => setDraft({ ...draft, purpose: event.target.value })}/> : purpose}
    actions={editing && draft ? <>
      <AccountRequestAction variant="neutral" disabled={save.isPending} onClick={() => setDraft(null)}>ยกเลิกการแก้ไข</AccountRequestAction>
      <AccountRequestAction variant="return"
        disabled={!context || ((!selectedStart || !selectedEnd) && !canSavePurposeOnly) || (purposeEditable && !draft.purpose.trim()) || save.isPending}
        onClick={() => {
          if (context) save.mutate({
            startsAt: keepOriginalTimes ? start : `${context.date}T${selectedStart}:00+07:00`,
            endsAt: keepOriginalTimes ? end : `${context.date}T${selectedEnd}:00+07:00`,
            purpose: draft.purpose.trim(),
          })
        }}>บันทึก</AccountRequestAction>
      {save.isError && <small role="alert">{save.error.message.includes('BOOKING_HAS_KEY_LOAN')
        ? 'ไม่สามารถเปลี่ยนเวลาของรายการที่มีการเบิกกุญแจแล้ว'
        : 'แก้ไขไม่สำเร็จ กรุณาตรวจสอบสถานะและช่วงเวลาว่าง'}</small>}
    </> : card.actions}/>
}
