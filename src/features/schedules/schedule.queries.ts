import { queryOptions } from '@tanstack/react-query'
import { getAcademicSchedules, getPublicScheduleEvents, getPublicScheduleRooms, getScheduleEvents, getScheduleRooms } from './schedule.service'
import type { ScheduleFilters } from './schedule.types'

export const scheduleKeys = {
  all: ['schedules'] as const,
  rooms: () => [...scheduleKeys.all, 'rooms'] as const,
  publicRooms: () => [...scheduleKeys.all, 'public-rooms'] as const,
  academic: () => [...scheduleKeys.all, 'academic'] as const,
  events: (filters: ScheduleFilters) => [...scheduleKeys.all, 'events', filters] as const,
  publicEvents: (filters: ScheduleFilters) => [...scheduleKeys.all, 'public-events', filters] as const,
}

export const roomsQuery = () => queryOptions({ queryKey: scheduleKeys.rooms(), queryFn: getScheduleRooms })
export const publicRoomsQuery = () => queryOptions({ queryKey: scheduleKeys.publicRooms(), queryFn: getPublicScheduleRooms, retry: 1, staleTime: 5 * 60 * 1000 })
export const academicSchedulesQuery = () => queryOptions({ queryKey: scheduleKeys.academic(), queryFn: getAcademicSchedules })
export const scheduleEventsQuery = (filters: ScheduleFilters) => queryOptions({ queryKey: scheduleKeys.events(filters), queryFn: () => getScheduleEvents(filters) })
export const publicScheduleEventsQuery = (filters: ScheduleFilters) => queryOptions({ queryKey: scheduleKeys.publicEvents(filters), queryFn: () => getPublicScheduleEvents(filters), retry: 1, staleTime: 60 * 1000 })
