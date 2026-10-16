import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { addDays, dateKey, isWithinCalendarBookingWindow, startOfSundayWeek, startOfWeek, weekRange } from './features/schedules/schedule.utils'
import { SCHEDULE_TIMES, WeeklySchedule } from './features/schedules/components/WeeklySchedule'
import { ROOM_MAP_ITEMS } from './features/rooms/room-map.config'
import { formatScheduleConflictMessage } from './features/schedules/schedule.service'
import { RoomCellActions } from './features/student/components/RoomCellActions'
import { AdminCellActions } from './features/admin/components/AdminCellActions'
import { ExternalBookingForm } from './features/bookings/components/ExternalBookingForm'
import { getExternalBookingForEdit } from './features/bookings/external-booking.service'
import { supabase } from './lib/supabase/client'
import { PublicLayout } from './features/public/components/PublicLayout'
import { UserBookingForm } from './features/bookings/components/UserBookingForm'
import { reportKeyStatus, requestBookingKey } from './features/keys/key.service'
import { markAllNotificationsRead, markNotificationRead } from './features/notifications/notification.queries'
import { keyStatusLabel } from './features/keys/utils/key-status.utils'
import { PasswordField } from './features/auth/components/PasswordField'
import { saveRoomUsagePolicy } from './features/policies/policy.service'

const authStateSubscription = { unsubscribe: vi.fn() }
function LocationProbe() { return <output>{useLocation().pathname}</output> }

vi.mock('./lib/supabase/client', () => ({
  setSessionPersistence: vi.fn(),
  execute: async (request: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await request
    if (error) throw new Error(error.message)
    return data
  },
  unwrap: async (request: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const { data, error } = await request
    if (error) throw new Error(error.message)
    return data
  },
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: authStateSubscription } })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => { const query = { select: vi.fn(), is: vi.fn(), order: vi.fn() } as { select: ReturnType<typeof vi.fn>; is: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn> }; query.select.mockReturnValue(query); query.is.mockReturnValue(query); query.order.mockResolvedValue({ data: [], error: null }); return query }),
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
    expect(await screen.findByRole('heading', { name: /แผนผังห้อง อาคารเรียน ชั้น 4/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'เข้าสู่ระบบ' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'เลือกห้อง' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'เลือกห้อง' })).not.toBeInTheDocument()
    expect(screen.queryByText(/reading 'rest'/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ภาพรวม' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ค้นหาห้อง' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'การจองของฉัน' })).not.toBeInTheDocument()
  })

  it('shows authenticated account paths in the public sidebar', () => {
    const identity = { userId: 'user-1', fullName: 'นักศึกษาทดสอบ', email: 'student@example.test', role: 'STUDENT' as const }
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Routes><Route element={<PublicLayout identity={identity} loading={false} onLogout={vi.fn()} />}><Route index element={<div>หน้าแรก</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    expect(screen.getByRole('link', { name: 'การจองและกุญแจ' })).toHaveAttribute('href', '/account/requests')
    expect(screen.getByRole('link', { name: 'ประวัติการใช้งาน' })).toHaveAttribute('href', '/account/history')
    expect(screen.queryByRole('link', { name: 'ค้นหาห้อง' })).not.toBeInTheDocument()
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

  it('creates a Sunday-through-Saturday public display range', () => {
    const sunday = startOfSundayWeek(new Date(2026, 9, 16))
    expect(dateKey(sunday)).toBe('2026-10-11')
    expect(weekRange(sunday)).toEqual({ from: '2026-10-11', to: '2026-10-17' })
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
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/rooms/room-1']}><RoomCellActions selection={{ date: '2026-10-18', time: '08:30', holiday: false }} authenticated={false} onClose={vi.fn()} /><LocationProbe /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'จองห้อง' }))
    expect(screen.getByText('/login')).toBeInTheDocument()
  })

  it('opens an embedded login form for a guest key request', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><RoomCellActions selection={{date:'2026-10-18',time:'08:30',holiday:false}} authenticated={false} onClose={vi.fn()}/></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button',{name:'เบิกกุญแจ'}))
    expect(screen.getByRole('heading',{name:'เข้าสู่ระบบ'})).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'ปิดหน้าต่างเข้าสู่ระบบ'})).toBeInTheDocument()
  })

  it('changes the password icon and field visibility together', () => {
    render(<PasswordField value="secret" onChange={vi.fn()}/>)
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveAttribute('type','password')
    fireEvent.click(screen.getByRole('button',{name:'แสดงรหัสผ่าน'}))
    expect(screen.getByLabelText('รหัสผ่าน')).toHaveAttribute('type','text')
    expect(screen.getByRole('button',{name:'ซ่อนรหัสผ่าน'})).toBeInTheDocument()
  })

  it('allows an authenticated user to book when the database grants permission', async () => {
    const onBook = vi.fn()
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ can_book: true, can_request_key: false, booking_reason: null, key_reason: 'ต้องจองห้องก่อน', class_schedule_id: null, own_booking_id: null }], error: null } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/rooms/room-1']}><RoomCellActions roomId="room-1" selection={{ date: '2026-10-18', time: '08:30', holiday: false }} authenticated onBook={onBook} onClose={vi.fn()} /><LocationProbe /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'จองห้อง' }))
    expect(screen.getByText('/rooms/room-1')).toBeInTheDocument()
    expect(onBook).toHaveBeenCalledOnce()
  })

  it('allows a student to request a key automatically for an active class', async () => {
    const onRequestKey = vi.fn()
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ can_book: false, can_request_key: true, booking_reason: 'ช่วงเวลานี้มีตารางเรียน', key_reason: null, class_schedule_id: 'class-1', own_booking_id: null }], error: null } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><RoomCellActions roomId="room-1" selection={{ date: '2026-10-18', time: '08:30', holiday: false }} authenticated onRequestKey={onRequestKey} onClose={vi.fn()} /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByRole('button', { name: 'จองห้อง' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'เบิกกุญแจ' }))
    expect(onRequestKey).toHaveBeenCalledWith(expect.objectContaining({ canRequestKey: true, classScheduleId: 'class-1' }))
  })

  it('disables public cells outside the three-day booking window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-16T10:00:00+07:00'))
    const view = render(<WeeklySchedule rangeStart={new Date(2026, 9, 11)} events={[]} bookingWindow onCellSelect={vi.fn()} />)
    expect(view.container.querySelectorAll('.booking-unavailable').length).toBeGreaterThan(0)
    view.container.querySelectorAll<HTMLButtonElement>('.booking-unavailable').forEach((cell) => expect(cell).toBeDisabled())
    expect(screen.getByTitle('ว่าง 2026-10-16-10:30')).toBeEnabled()
    vi.useRealTimers()
  })

  it('allows every operating-hour slot on the third calendar day', () => {
    const now = new Date('2026-10-16T17:00:00+07:00')
    expect(isWithinCalendarBookingWindow(new Date('2026-10-19T08:30:00+07:00'), now)).toBe(true)
    expect(isWithinCalendarBookingWindow(new Date('2026-10-20T08:30:00+07:00'), now)).toBe(false)
  })

  it('renders the current user booking with a green ownership class', () => {
    const event = { id:'booking-1',eventType:'BOOKING' as const,title:'มีการจองห้อง',startsAt:'2026-10-16T08:30:00+07:00',endsAt:'2026-10-16T09:30:00+07:00',sourceId:'',status:'APPROVED',isMine:true }
    const view=render(<WeeklySchedule rangeStart={new Date(2026,9,11)} events={[event]} />)
    expect(view.container.querySelector('.event-booking.event-mine')).toBeInTheDocument()
  })

  it('creates a key-required booking without a user-name field', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'booking-1', booking_code: 'B001', status: 'PENDING' }, error: null } as never)
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><UserBookingForm roomId="room-1" date="2026-10-19" time="08:30" requiresKey onClose={vi.fn()} /></QueryClientProvider>)
    expect(screen.queryByLabelText(/ชื่อผู้/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('เหตุผลในการเบิก'), { target: { value: 'ใช้ประกอบการเรียน' } })
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการเบิกกุญแจ' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('create_booking', expect.objectContaining({ p_room_id: 'room-1', p_purpose: 'ใช้ประกอบการเรียน', p_requires_key: true })))
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

  it('soft-cancels an external booking from its edit form', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ booking_id: 'booking-1', external_name: 'ผู้มาติดต่อ', reason: 'ประชุม', starts_at: '2026-10-16T01:30:00Z', ends_at: '2026-10-16T02:30:00Z' }], error: null } as never)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><ExternalBookingForm roomId="room-1" date="2026-10-16" time="08:30" bookingId="booking-1" onClose={vi.fn()} /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'ลบการจอง' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('cancel_booking', { p_booking_id: 'booking-1', p_reason: 'ยกเลิกจากหน้าจัดการการจองบุคคลภายนอก' }))
  })

  it('marks one or all notifications read through owner-checked RPCs', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as never)
    await markNotificationRead('notification-1')
    await markAllNotificationsRead()
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'mark_notification_read', { p_notification_id: 'notification-1' })
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'mark_all_notifications_read')
  })

  it('reports borrower key lifecycle actions through one controlled RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id:'loan-1', status:'DAMAGED' }, error: null } as never)
    await reportKeyStatus('loan-1','DAMAGED','ตัวกุญแจแตกร้าว')
    expect(supabase.rpc).toHaveBeenCalledWith('report_key_status',{p_key_loan_id:'loan-1',p_action:'DAMAGED',p_description:'ตัวกุญแจแตกร้าว'})
  })

  it('completes a borrower key return through the self-service RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id:'loan-1', status:'RETURNED' }, error: null } as never)
    await reportKeyStatus('loan-1','RETURNED')
    expect(supabase.rpc).toHaveBeenCalledWith('report_key_status',{p_key_loan_id:'loan-1',p_action:'RETURNED',p_description:null})
  })

  it('requests an owned booking key through the auto-approval RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id:'loan-2', status:'APPROVED' }, error: null } as never)
    await requestBookingKey('booking-1','ใช้งานตามเวลาจอง')
    expect(supabase.rpc).toHaveBeenCalledWith('request_booking_key',{p_booking_id:'booking-1',p_notes:'ใช้งานตามเวลาจอง'})
  })

  it('labels a late user-reported return for the administrator', () => {
    expect(keyStatusLabel({status:'RETURN_REPORTED',returnedLate:true} as never)).toBe('คืนกุญแจช้ากว่ากำหนด')
    expect(keyStatusLabel({status:'RETURN_REPORTED',returnedLate:false} as never)).toBe('คืนกุญแจ')
  })

  it('saves every configurable usage permission through the controlled RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({data:{},error:null} as never)
    await saveRoomUsagePolicy({roomId:'room-1',guestViewDetails:true,guestViewSchedule:true,studentViewDetails:true,studentViewSchedule:true,studentBookEmpty:false,studentClassKey:true,studentOwnBookingKey:true,studentManageOwnBooking:true,studentViewOwnKeyStatus:true,studentViewOwnHistory:true,manualApproval:true})
    expect(supabase.rpc).toHaveBeenCalledWith('update_room_usage_policy',{p_room_id:'room-1',p_policy:expect.objectContaining({student_class_key:true,student_book_empty:false,manual_approval:true})})
  })

  it('keeps room targets separate from non-clickable map references', () => {
    const selectableCodes = ROOM_MAP_ITEMS.filter((item) => item.kind === 'room').map((item) => item.layoutKey)
    expect(selectableCodes).toHaveLength(16)
    expect(selectableCodes).toEqual(expect.arrayContaining(['2401', '2406', 'STUDIO', 'ESPORT', 'ELEARNING', 'MEET-FACULTY', 'S2407', 'S2412']))
    expect(ROOM_MAP_ITEMS.some((item) => item.kind === 'reference' && item.label === 'ทางเดิน')).toBe(true)
  })
})
