export type ScheduleEventType = 'CLASS' | 'BOOKING' | 'BLOCK'

export interface ScheduleEvent {
  id: string
  eventType: ScheduleEventType
  title: string
  startsAt: string
  endsAt: string
  sourceId: string
  status: string
}

export interface AcademicSchedule {
  id: string
  roomId: string
  roomLabel: string
  courseCode: string
  courseName: string
  academicYear: string
  semester: string
  teacherId: string | null
  teacherName: string | null
  dayOfWeek: number
  startTime: string
  endTime: string
  effectiveFrom: string
  effectiveUntil: string
  active: boolean
}

export interface AcademicScheduleInput extends Omit<AcademicSchedule, 'id' | 'roomLabel' | 'teacherName'> {
  id?: string
}

export interface ScheduleRoom {
  id: string
  code: string
  name: string
  building: string | null
  floor: string | null
  capacity: number
  active: boolean
  bookingEnabled: boolean
  roomTypeName: string
  academicScheduleConfirmed: boolean
}

export interface ScheduleFilters {
  roomId?: string
  from: string
  to: string
}
