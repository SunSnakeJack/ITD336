import { supabase, unwrap } from '../../lib/supabase/client'
import type { AcademicSchedule, AcademicScheduleInput, ScheduleEvent, ScheduleFilters, ScheduleRoom } from './schedule.types'

type UnknownRow = Record<string, unknown>
interface RpcResult<T> { data: T | null; error: { message: string } | null }

async function callRpc<T>(name: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  return await supabase.rpc(name as never, args as never) as unknown as RpcResult<T>
}

function text(row: UnknownRow, key: string, fallback = '') { return typeof row[key] === 'string' ? row[key] as string : fallback }
function nullableText(row: UnknownRow, key: string) { return typeof row[key] === 'string' ? row[key] as string : null }
function bool(row: UnknownRow, key: string, fallback = false) { return typeof row[key] === 'boolean' ? row[key] as boolean : fallback }
function num(row: UnknownRow, key: string, fallback = 0) { return typeof row[key] === 'number' ? row[key] as number : fallback }

export async function getScheduleRooms(): Promise<ScheduleRoom[]> {
  const rows = await unwrap<UnknownRow[]>(supabase.from('rooms').select('*, room_types(name)').order('code'))
  return rows.map((row) => {
    const roomType = row.room_types as UnknownRow | null
    return {
      id: text(row, 'id'), code: text(row, 'code'), layoutKey: text(row, 'layout_key', text(row, 'code')), name: text(row, 'name'),
      building: nullableText(row, 'building'), floor: nullableText(row, 'floor'), capacity: num(row, 'capacity'),
      active: bool(row, 'active'), bookingEnabled: bool(row, 'booking_enabled'),
      roomTypeName: roomType ? text(roomType, 'name', 'ไม่ระบุ') : 'ไม่ระบุ',
      academicScheduleConfirmed: bool(row, 'academic_schedule_confirmed'),
    }
  })
}

function mapPublicRoom(row: UnknownRow): ScheduleRoom {
  return { id: text(row, 'id'), code: text(row, 'code'), layoutKey: text(row, 'layout_key', text(row, 'code')), name: text(row, 'name'), building: nullableText(row, 'building'), floor: nullableText(row, 'floor'), capacity: num(row, 'capacity'), active: bool(row, 'active'), bookingEnabled: false, roomTypeName: text(row, 'room_type_name', 'ไม่ระบุ'), academicScheduleConfirmed: bool(row, 'academic_schedule_confirmed') }
}

export async function getPublicScheduleRooms(): Promise<ScheduleRoom[]> {
  const result = await callRpc<UnknownRow[]>('get_public_room_catalog', {})
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []).map(mapPublicRoom)
}

export async function getAcademicSchedules(): Promise<AcademicSchedule[]> {
  const rows = await unwrap<UnknownRow[]>(supabase.from('class_schedules').select('*, rooms(code,name), profiles!class_schedules_teacher_id_fkey(full_name)').order('course_code'))
  return rows.map((row) => {
    const room = row.rooms as UnknownRow | null
    const teacher = row.profiles as UnknownRow | null
    const start = text(row, 'starts_at')
    const end = text(row, 'ends_at')
    return {
      id: text(row, 'id'), roomId: text(row, 'room_id'),
      roomLabel: room ? `${text(room, 'code')} · ${text(room, 'name')}` : 'ไม่พบห้อง',
      courseCode: text(row, 'course_code'), courseName: text(row, 'subject_name'), academicYear: text(row, 'academic_year'), semester: text(row, 'semester'),
      teacherId: nullableText(row, 'teacher_id'), teacherName: teacher ? nullableText(teacher, 'full_name') : null,
      dayOfWeek: num(row, 'day_of_week', start ? new Date(start).getDay() : 1),
      startTime: text(row, 'start_time', start ? start.slice(11, 16) : '08:00'),
      endTime: text(row, 'end_time', end ? end.slice(11, 16) : '09:00'),
      effectiveFrom: text(row, 'effective_from', start.slice(0, 10)), effectiveUntil: text(row, 'effective_until', end.slice(0, 10)),
      active: bool(row, 'active', true),
    }
  })
}

export async function getScheduleEvents(filters: ScheduleFilters): Promise<ScheduleEvent[]> {
  const result = await callRpc<UnknownRow[]>('get_room_schedule_events', {
    p_room_id: filters.roomId || null, p_range_start: filters.from, p_range_end: filters.to,
  })
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []).map((row) => ({
    id: text(row, 'id'), eventType: (text(row, 'event_type') === 'BOOKING' ? 'BOOKING' : text(row, 'event_type') === 'CLASS' ? 'CLASS' : 'BLOCK') as ScheduleEvent['eventType'],
    title: text(row, 'title'), startsAt: text(row, 'starts_at'), endsAt: text(row, 'ends_at'),
    sourceId: text(row, 'source_id'), status: text(row, 'status'),
  }))
}

export async function getPublicScheduleEvents(filters: ScheduleFilters): Promise<ScheduleEvent[]> {
  if (!filters.roomId) return []
  const result = await callRpc<UnknownRow[]>('get_public_room_schedule_events', { p_room_id: filters.roomId, p_range_start: filters.from, p_range_end: filters.to })
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []).map((row) => ({ id: text(row, 'id'), eventType: (text(row, 'event_type') === 'BOOKING' ? 'BOOKING' : text(row, 'event_type') === 'CLASS' ? 'CLASS' : 'BLOCK') as ScheduleEvent['eventType'], title: text(row, 'title'), startsAt: text(row, 'starts_at'), endsAt: text(row, 'ends_at'), sourceId: '', status: text(row, 'status'), isMine: bool(row, 'is_mine') }))
}

export async function saveAcademicSchedule(input: AcademicScheduleInput) {
  const conflictResult = await callRpc<UnknownRow[]>('find_academic_schedule_conflict', {
    p_schedule_id: input.id ?? null, p_room_id: input.roomId, p_day_of_week: input.dayOfWeek,
    p_start_time: input.startTime, p_end_time: input.endTime, p_effective_from: input.effectiveFrom, p_effective_until: input.effectiveUntil,
  })
  if (conflictResult.error) throw new Error(conflictResult.error.message)
  const conflict = conflictResult.data?.[0]
  if (conflict) throw new Error(formatScheduleConflictMessage(conflict))
  const result = await callRpc<string>('upsert_academic_schedule', {
    p_schedule_id: input.id ?? null, p_room_id: input.roomId, p_course_code: input.courseCode,
    p_subject_name: input.courseName, p_academic_year: input.academicYear, p_semester: input.semester, p_teacher_id: input.teacherId,
    p_day_of_week: input.dayOfWeek, p_start_time: input.startTime, p_end_time: input.endTime,
    p_effective_from: input.effectiveFrom, p_effective_until: input.effectiveUntil,
  })
  if (result.error) {
    if (result.error.message.includes('ACADEMIC_SCHEDULE_CONFLICT')) throw new Error('ไม่สามารถบันทึกได้ เนื่องจากมีตารางเรียนในช่วงเวลานี้แล้ว กรุณาโหลดข้อมูลล่าสุดและลองใหม่')
    if (result.error.message.includes('BOOKING_CONFLICT')) throw new Error('ไม่สามารถบันทึกได้ เนื่องจากมีการจองห้องในช่วงเวลานี้แล้ว')
    if (result.error.message.includes('ROOM_BLOCK_CONFLICT')) throw new Error('ไม่สามารถบันทึกได้ เนื่องจากห้องถูกปิดใช้งานในช่วงเวลานี้')
    throw new Error(result.error.message)
  }
  return result.data
}

export function formatScheduleConflictMessage(row: UnknownRow) {
  const days = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์']
  const day = days[num(row, 'day_of_week')] ?? 'วันที่เลือก'
  const start = text(row, 'start_time').slice(0, 5)
  const end = text(row, 'end_time').slice(0, 5)
  const course = [text(row, 'course_code'), text(row, 'subject_name')].filter(Boolean).join(' · ')
  return `ไม่สามารถบันทึกได้: ${day} เวลา ${start}–${end} มีวิชา ${course || 'อื่น'} อยู่แล้ว`
}

export async function deactivateAcademicSchedule(id: string) {
  const result = await callRpc<boolean>('deactivate_academic_schedule', { p_schedule_id: id, p_reason: 'ปิดใช้งานจากหน้าจัดการตารางเรียน' })
  if (result.error) throw new Error(result.error.message)
}

export async function confirmRoomSchedule(roomId: string, confirmed: boolean) {
  const result = await callRpc<boolean>('set_room_schedule_confirmation', { p_room_id: roomId, p_confirmed: confirmed })
  if (result.error) throw new Error(result.error.message)
}

export async function updateRoomAvailability(roomId: string, active: boolean) {
  const result = await callRpc<boolean>('set_room_availability', { p_room_id: roomId, p_active: active })
  if (result.error) throw new Error(result.error.message)
}

export async function updateRoomDetails(input: { roomId: string; code: string; name: string; capacity: number; active: boolean }) {
  const result = await callRpc<boolean>('update_room_details_v2', {
    p_room_id: input.roomId, p_code: input.code, p_name: input.name, p_capacity: input.capacity, p_active: input.active,
  })
  if (result.error) {
    if (result.error.message.includes('ROOM_CODE_ALREADY_EXISTS')) throw new Error('รหัสห้องนี้ถูกใช้งานแล้ว')
    if (result.error.message.includes('INVALID_ROOM_CODE')) throw new Error('รหัสห้องใช้ได้เฉพาะ A–Z, 0–9, ขีดกลาง และขีดล่าง')
    if (result.error.message.includes('ROOM_NAME_REQUIRED')) throw new Error('กรุณาระบุชื่อห้อง')
    if (result.error.message.includes('INVALID_ROOM_CAPACITY')) throw new Error('ความจุห้องต้องอยู่ระหว่าง 1–1,000 คน')
    throw new Error(result.error.message)
  }
}
