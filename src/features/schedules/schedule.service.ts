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
      id: text(row, 'id'), code: text(row, 'code'), name: text(row, 'name'),
      building: nullableText(row, 'building'), floor: nullableText(row, 'floor'), capacity: num(row, 'capacity'),
      active: bool(row, 'active'), bookingEnabled: bool(row, 'booking_enabled'),
      roomTypeName: roomType ? text(roomType, 'name', 'ไม่ระบุ') : 'ไม่ระบุ',
      academicScheduleConfirmed: bool(row, 'academic_schedule_confirmed'),
    }
  })
}

function mapPublicRoom(row: UnknownRow): ScheduleRoom {
  return { id: text(row, 'id'), code: text(row, 'code'), name: text(row, 'name'), building: nullableText(row, 'building'), floor: nullableText(row, 'floor'), capacity: num(row, 'capacity'), active: bool(row, 'active'), bookingEnabled: false, roomTypeName: text(row, 'room_type_name', 'ไม่ระบุ'), academicScheduleConfirmed: bool(row, 'academic_schedule_confirmed') }
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
  return (result.data ?? []).map((row) => ({ id: text(row, 'id'), eventType: (text(row, 'event_type') === 'BOOKING' ? 'BOOKING' : text(row, 'event_type') === 'CLASS' ? 'CLASS' : 'BLOCK') as ScheduleEvent['eventType'], title: text(row, 'title'), startsAt: text(row, 'starts_at'), endsAt: text(row, 'ends_at'), sourceId: '', status: text(row, 'status') }))
}

export async function saveAcademicSchedule(input: AcademicScheduleInput) {
  const result = await callRpc<string>('upsert_academic_schedule', {
    p_schedule_id: input.id ?? null, p_room_id: input.roomId, p_course_code: input.courseCode,
    p_subject_name: input.courseName, p_academic_year: input.academicYear, p_semester: input.semester, p_teacher_id: input.teacherId,
    p_day_of_week: input.dayOfWeek, p_start_time: input.startTime, p_end_time: input.endTime,
    p_effective_from: input.effectiveFrom, p_effective_until: input.effectiveUntil,
  })
  if (result.error) throw new Error(result.error.message)
  return result.data
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
