import { supabase } from '../../lib/supabase/client'
import type { RpcResult } from './booking.types'
import type { ExternalBookingDetail, ExternalBookingInput } from './external-booking.types'

type UnknownRow = Record<string, unknown>

function bangkokInstant(date: string, time: string) {
  return `${date}T${time}:00+07:00`
}

function bangkokDateTime(iso: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]))
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` }
}

export async function createExternalBooking(input: ExternalBookingInput): Promise<RpcResult> {
  const result = await supabase.rpc('create_external_booking', {
    p_external_name: input.externalName.trim(),
    p_organization_name: null,
    p_room_id: input.roomId,
    p_starts_at: bangkokInstant(input.date, input.startTime),
    p_ends_at: bangkokInstant(input.date, input.endTime),
    p_purpose: input.reason.trim(),
    p_reason: input.reason.trim(),
  } as never) as unknown as { data: RpcResult | null; error: { message: string } | null }
  if (result.error) {
    if (result.error.message.includes('ROOM_UNAVAILABLE')) throw new Error('ไม่สามารถจองได้ เนื่องจากช่วงเวลานี้มีรายการใช้งานห้องอยู่แล้ว')
    if (result.error.message.includes('INVALID_TIME_RANGE')) throw new Error('ช่วงเวลาที่เลือกไม่ถูกต้อง หรือเป็นช่วงเวลาที่ผ่านมาแล้ว')
    if (result.error.message.includes('ROOM_NOT_AVAILABLE')) throw new Error('ห้องนี้ปิดใช้งานหรือไม่อนุญาตให้จอง')
    throw new Error(result.error.message)
  }
  if (!result.data) throw new Error('ไม่สามารถสร้างรายการจองได้')
  return result.data
}

function bookingError(message: string) {
  if (message.includes('ROOM_UNAVAILABLE')) return new Error('ไม่สามารถบันทึกได้ เนื่องจากช่วงเวลานี้มีตารางเรียน การจอง หรือช่วงปิดห้องอยู่แล้ว')
  if (message.includes('INVALID_TIME_RANGE')) return new Error('ช่วงเวลาที่เลือกไม่ถูกต้อง หรือเป็นช่วงเวลาที่ผ่านมาแล้ว')
  if (message.includes('EXTERNAL_BOOKING_NOT_EDITABLE')) return new Error('รายการจองนี้ไม่อยู่ในสถานะที่แก้ไขได้')
  return new Error(message)
}

export async function getExternalBookingForEdit(bookingId: string): Promise<ExternalBookingDetail> {
  const result = await supabase.rpc('get_external_booking_for_edit' as never, { p_booking_id: bookingId } as never) as unknown as { data: UnknownRow[] | null; error: { message: string } | null }
  if (result.error) throw bookingError(result.error.message)
  const row = result.data?.[0]
  if (!row) throw new Error('รายการนี้ไม่ใช่การจองบุคคลภายนอก หรือไม่อยู่ในสถานะที่แก้ไขได้')
  const startsAt = String(row.starts_at ?? '')
  const endsAt = String(row.ends_at ?? '')
  const start = bangkokDateTime(startsAt)
  const end = bangkokDateTime(endsAt)
  return {
    bookingId: String(row.booking_id), externalName: String(row.external_name), reason: String(row.reason),
    date: start.date, startTime: start.time, endTime: end.time,
  }
}

export async function updateExternalBooking(input: ExternalBookingInput): Promise<RpcResult> {
  if (!input.bookingId) throw new Error('ไม่พบรหัสรายการจอง')
  const result = await supabase.rpc('update_external_booking' as never, {
    p_booking_id: input.bookingId,
    p_external_name: input.externalName.trim(),
    p_starts_at: bangkokInstant(input.date, input.startTime),
    p_ends_at: bangkokInstant(input.date, input.endTime),
    p_reason: input.reason.trim(),
  } as never) as unknown as { data: RpcResult | null; error: { message: string } | null }
  if (result.error) throw bookingError(result.error.message)
  if (!result.data) throw new Error('ไม่สามารถแก้ไขรายการจองได้')
  return result.data
}
