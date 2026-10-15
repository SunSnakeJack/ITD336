import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { addDays, dateKey, startOfWeek, weekRange } from './features/schedules/schedule.utils'
import { SCHEDULE_TIMES, WeeklySchedule } from './features/schedules/components/WeeklySchedule'
import { ROOM_MAP_ITEMS } from './features/rooms/room-map.config'
import { formatScheduleConflictMessage } from './features/schedules/schedule.service'
import { RoomCellActions } from './features/student/components/RoomCellActions'
import { AdminCellActions } from './features/admin/components/AdminCellActions'
import { ExternalBookingForm } from './features/bookings/components/ExternalBookingForm'
import { getExternalBookingForEdit } from './features/bookings/external-booking.service'
import { supabase } from './lib/supabase/client'

const authStateSubscription = { unsubscribe: vi.fn() }
function LocationProbe() { return <output>{useLocation().pathname}</output> }

vi.mock('./lib/supabase/client', () => ({
  setSessionPersistence: vi.fn(),
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: authStateSubscription } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}))

describe('Authentication entry point', () => {
  beforeEach(() => vi.clearAllMocks())

  const renderPath = (path: string) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>)

  it('presents the university login form when there is no session', async () => {
    renderPath('/login')

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    expect(screen.getByLabelText('อีเมล')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Remember Me' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument()
    expect(screen.getByText('Forgot Password')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Login with Google' })).toBeDisabled()
    expect(screen.getByText('Sign up')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: /เว็บไซต์มหาวิทยาลัยนอร์ทกรุงเทพ/ })).toHaveAttribute(
      'href',
      'https://nbu-mockup.vercel.app/',
    )
    expect(screen.getByRole('link', { name: /เว็บไซต์มหาวิทยาลัยนอร์ทกรุงเทพ/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /เว็บไซต์มหาวิทยาลัยนอร์ทกรุงเทพ/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  })

  it('shows the room map to a guest at the root route', async () => {
    renderPath('/')
    expect(await screen.findByRole('heading', { name: 'แผนผังห้อง' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'เลือกห้อง' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'เลือกห้อง' })).not.toBeInTheDocument()
    expect(screen.queryByText(/reading 'rest'/)).not.toBeInTheDocument()
  })
})

describe('schedule date helpers', () => {
  it('formats a detailed Thai message for an academic schedule conflict', () => {
    expect(formatScheduleConflictMessage({ day_of_week: 1, course_code: 'ITD101', subject_name: 'การเขียนโปรแกรม', start_time: '09:30:00', end_time: '10:30:00' })).toBe('ไม่สามารถบันทึกได้: วันจันทร์ เวลา 09:30–10:30 มีวิชา ITD101 · การเขียนโปรแกรม อยู่แล้ว')
  })
  it('creates a Monday-through-Sunday display range', () => {
    const monday = startOfWeek(new Date(2026, 9, 15))
    expect(dateKey(monday)).toBe('2026-10-12')
    expect(weekRange(monday)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    expect(dateKey(addDays(monday, 7))).toBe('2026-10-19')
  })

  it('builds hourly slots from 08:30 through 17:30', () => {
    expect(SCHEDULE_TIMES).toHaveLength(10)
    expect(SCHEDULE_TIMES[0]).toBe('08:30')
    expect(SCHEDULE_TIMES.at(-1)).toBe('17:30')
  })

  it('renders every Saturday slot as a disabled holiday', () => {
    render(<WeeklySchedule rangeStart={new Date(2026, 9, 12)} events={[]} onEmptyCellSelect={vi.fn()} />)
    const holidays = screen.getAllByRole('button', { name: 'วันหยุด' })
    expect(holidays).toHaveLength(10)
    holidays.forEach((slot) => expect(slot).toBeDisabled())
  })

  it('allows the public room view to select every cell, including holidays', () => {
    const onCellSelect = vi.fn()
    render(<WeeklySchedule rangeStart={new Date(2026, 9, 12)} events={[]} onCellSelect={onCellSelect} />)
    const holiday = screen.getAllByRole('button', { name: 'วันหยุด' })[0]
    expect(holiday).toBeEnabled()
    holiday.click()
    expect(onCellSelect).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-17', time: '08:30', holiday: true }))
  })

  it('sends a public room action to the login page', () => {
    render(<MemoryRouter initialEntries={['/rooms/room-1']}><RoomCellActions selection={{ date: '2026-10-18', time: '08:30', holiday: false }} onClose={vi.fn()} /><LocationProbe /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'จองห้อง' }))
    expect(screen.getByText('/login')).toBeInTheDocument()
  })

  it('allows an administrator to select an existing class event for editing', () => {
    const onEventSelect = vi.fn()
    const classEvent = { id: 'event-1', eventType: 'CLASS' as const, title: 'ITD101 · Test', startsAt: '2026-10-12T08:30:00+07:00', endsAt: '2026-10-12T09:30:00+07:00', sourceId: 'schedule-1', status: 'ACTIVE' }
    render(<WeeklySchedule rangeStart={new Date(2026, 9, 12)} events={[classEvent]} onEventSelect={onEventSelect} />)
    screen.getByRole('button', { name: /ClassITD101/ }).click()
    expect(onEventSelect).toHaveBeenCalledWith(classEvent)
  })

  it('allows an administrator to select an existing booking for editing', () => {
    const onEventSelect = vi.fn()
    const bookingEvent = { id: 'booking-1', eventType: 'BOOKING' as const, title: 'ผู้มาติดต่อ', startsAt: '2026-10-16T08:30:00+07:00', endsAt: '2026-10-16T09:30:00+07:00', sourceId: 'booking-id-1', status: 'APPROVED' }
    render(<WeeklySchedule rangeStart={new Date(2026, 9, 12)} events={[bookingEvent]} onEventSelect={onEventSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /Bookedผู้มาติดต่อ/ }))
    expect(onEventSelect).toHaveBeenCalledWith(bookingEvent)
  })

  it('asks an administrator to choose the type of use before opening a form', () => {
    const onExternalBooking = vi.fn()
    const onAcademicSchedule = vi.fn()
    render(<AdminCellActions date="2026-10-14" time="08:30" onClose={vi.fn()} onExternalBooking={onExternalBooking} onAcademicSchedule={onAcademicSchedule} />)
    fireEvent.click(screen.getByRole('button', { name: 'จองห้องสำหรับบุคคลภายนอก' }))
    expect(onExternalBooking).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มตารางเรียน' }))
    expect(onAcademicSchedule).toHaveBeenCalledOnce()
  })

  it('shows the external booking fields without an academic term field', () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><ExternalBookingForm roomId="room-1" date="2026-10-14" time="08:30" onClose={vi.fn()} /></QueryClientProvider>)
    expect(screen.getByLabelText('ชื่อบุคคลภายนอก')).toBeInTheDocument()
    expect(screen.getByLabelText('เหตุผลการจอง')).toBeInTheDocument()
    expect(screen.queryByLabelText('ภาคเรียน')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'บันทึกการจอง' })).toBeInTheDocument()
  })

  it('maps an external booking timestamp to Bangkok date and time for editing', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ booking_id: 'booking-1', external_name: 'ผู้มาติดต่อ', reason: 'ประชุม', starts_at: '2026-10-16T01:30:00Z', ends_at: '2026-10-16T02:30:00Z' }], error: null } as never)
    await expect(getExternalBookingForEdit('booking-1')).resolves.toEqual({ bookingId: 'booking-1', externalName: 'ผู้มาติดต่อ', reason: 'ประชุม', date: '2026-10-16', startTime: '08:30', endTime: '09:30' })
  })

  it('keeps room targets separate from non-clickable map references', () => {
    const selectableCodes = ROOM_MAP_ITEMS.filter((item) => item.kind === 'room').map((item) => item.code)
    expect(selectableCodes).toHaveLength(16)
    expect(selectableCodes).toEqual(expect.arrayContaining(['2401', '2406', 'STUDIO', 'ESPORT', 'ELEARNING', 'MEET-FACULTY', 'S2407', 'S2412']))
    expect(ROOM_MAP_ITEMS.some((item) => item.kind === 'reference' && item.label === 'ทางเดิน')).toBe(true)
  })
})
