import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { createKeyRequest, reportKeyStatus, requestBookingKey } from './features/keys/key.service'
import { markAllNotificationsRead, markNotificationRead } from './features/notifications/notification.queries'
import { keyStatusLabel } from './features/keys/utils/key-status.utils'
import { getBorrowerIdentity, keyCabinetLabels } from './features/keys/utils/admin-key.utils'
import { PasswordField } from './features/auth/components/PasswordField'
import { saveRoomUsagePolicy } from './features/policies/policy.service'
import { canCancelBooking, effectiveBookingStatus } from './features/bookings/booking-status.utils'
import { getMyIdentity, normalizeAuthReturnTo } from './features/auth/auth.service'
import { AccountKeyRequestHistoryPage } from './features/keys/pages/AccountKeyRequestHistoryPage'
import { meetingTimeOptions } from './features/meeting-rooms/utils/meeting-time-options'
import { AccountProfilePage } from './features/public/pages/AccountProfilePage'

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
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn(() => { const query = { select: vi.fn(), is: vi.fn(), order: vi.fn() } as { select: ReturnType<typeof vi.fn>; is: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn> }; query.select.mockReturnValue(query); query.is.mockReturnValue(query); query.order.mockResolvedValue({ data: [], error: null }); return query }),
      functions: { invoke: vi.fn() },
  },
}))

describe('Authentication entry point', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-08T19:00:00+07:00'))
    vi.clearAllMocks()
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never)
  })

  afterEach(() => vi.useRealTimers())

  const renderPath = (path: string) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></QueryClientProvider>)

  it('keeps an authenticated Google user signed in when no role is assigned', async () => {
    vi.mocked(supabase.from).mockImplementation(((table:string) => {
      if(table==='profiles'){
        const query={select:vi.fn(),eq:vi.fn(),single:vi.fn()}
        query.select.mockReturnValue(query);query.eq.mockReturnValue(query)
        query.single.mockResolvedValue({data:{id:'google-user',full_name:'Google User',email:'student@northbkk.ac.th',account_status:'ACTIVE'},error:null})
        return query
      }
      const query={select:vi.fn(),eq:vi.fn()}
      query.select.mockReturnValue(query);query.eq.mockResolvedValue({data:[],error:null})
      return query
    }) as never)

    await expect(getMyIdentity('google-user')).resolves.toMatchObject({userId:'google-user',role:null})
    expect(supabase.auth.signOut).not.toHaveBeenCalled()
  })

  it('keeps the key catalog return path and rejects external redirects', () => {
    expect(normalizeAuthReturnTo('/keys')).toBe('/keys')
    expect(normalizeAuthReturnTo('/meeting-room/meeting-1/request?start=12:30')).toBe('/meeting-room/meeting-1/request?start=12:30')
    expect(normalizeAuthReturnTo('https://evil.example/keys')).toBe('/keys')
    expect(normalizeAuthReturnTo('//evil.example/keys')).toBe('/keys')
  })

  it('protects the staff entry route with the existing administrator guard', async () => {
    renderPath('/staff')
    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument()
  })

  it('automatically completes an email cancellation through the frontend', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{ok:true,requestCode:'KR-1',status:'CANCELLED'},error:null} as never)
    renderPath(`/key-request-action?action=CANCEL&token=${'a'.repeat(64)}`)
    expect(await screen.findByRole('heading',{name:'ยกเลิกคำขอสำเร็จ'})).toBeInTheDocument()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('key-request-action',{body:{action:'CANCEL',token:'a'.repeat(64)}})
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('automatically completes an email return through the frontend', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{ok:true,requestCode:'KR-2',status:'RETURNED'},error:null} as never)
    renderPath(`/key-request-action?action=RETURN&token=${'c'.repeat(64)}`)
    expect(await screen.findByRole('heading',{name:'ยืนยันคืนกุญแจสำเร็จ'})).toBeInTheDocument()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('key-request-action',{body:{action:'RETURN',token:'c'.repeat(64)}})
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('shows an expired secure-link error without changing a request', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{ok:false,code:'ACTION_TOKEN_EXPIRED',message:'ลิงก์หมดอายุแล้ว'},error:null} as never)
    renderPath(`/key-request-action?action=CANCEL&token=${'b'.repeat(64)}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('ลิงก์หมดอายุแล้ว')
  })

  it.each([
    ['ACTION_TOKEN_ALREADY_USED','ลิงก์นี้ถูกใช้งานแล้ว'],
    ['INVALID_ACTION_TOKEN','ลิงก์ไม่ถูกต้อง'],
    ['KEY_REQUEST_NOT_CANCELLABLE','คำขอนี้ถูกยกเลิกแล้วหรือไม่อยู่ในสถานะที่ยกเลิกได้'],
    ['KEY_REQUEST_NOT_RETURNABLE','คำขอนี้ยังไม่อยู่ในสถานะที่คืนกุญแจได้'],
  ])('shows the backend result for %s',async(code,message)=>{
    vi.mocked(supabase.functions.invoke).mockResolvedValue({data:{ok:false,code,message},error:null} as never)
    renderPath(`/key-request-action?action=CANCEL&token=${'d'.repeat(64)}`)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('shows an email-matched legacy request as read-only history', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({data:[{id:'legacy-1',request_code:'KR-1',room_code:'S2407',room_name:'ห้อง S2407',starts_at:'2026-11-08T10:00:00+07:00',ends_at:'2026-11-08T10:30:00+07:00',purpose:'ทดสอบ',purpose_type:'OTHER',course_code:null,lecturer_name:null,status:'APPROVED',can_cancel:false}],error:null} as never)
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AccountKeyRequestHistoryPage/></QueryClientProvider>)
    expect(await screen.findByText('ห้อง S2407')).toBeInTheDocument()
    expect(screen.getByText('สิ้นสุดแล้ว')).toHaveClass('muted')
    expect(screen.queryByRole('button',{name:'ยกเลิกรายการ'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'ยืนยันการคืนกุญแจ'})).not.toBeInTheDocument()
  })

  it('shows room metadata, duration, and cancellation for an eligible request', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({data:[{id:'owned-1',request_code:'KR-2',room_code:'S2408',room_name:'ห้องปฏิบัติการ S2408',room_type_name:'ห้องปฏิบัติการ',floor:'4',starts_at:'2026-11-08T17:30:00+07:00',ends_at:'2026-11-08T18:00:00+07:00',purpose:'เปิดห้องเพื่อการเรียนการสอน',purpose_type:'TEACHING',course_code:null,lecturer_name:null,status:'APPROVED',can_cancel:true}],error:null} as never)
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AccountKeyRequestHistoryPage/></QueryClientProvider>)
    expect(await screen.findByText('ห้องปฏิบัติการ')).toBeInTheDocument()
    expect(screen.getByText('S2408 • ชั้น 4')).toBeInTheDocument()
    expect(screen.getByText('ระยะเวลา 30 นาที')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'ยกเลิกรายการ'})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'ยืนยันการคืนกุญแจ'})).not.toBeInTheDocument()
  })

  it('returns an active owned key request and refreshes its history', async () => {
    vi.setSystemTime(new Date('2026-11-08T15:30:00+07:00'))
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({data:[{id:'active-1',request_code:'KR-4',room_code:'S2407',room_name:'ห้อง S2407',room_type_name:'Computer Room',floor:'4',starts_at:'2026-11-08T15:00:00+07:00',ends_at:'2026-11-08T18:00:00+07:00',purpose:'ทดสอบ',purpose_type:'OTHER',course_code:null,lecturer_name:null,status:'APPROVED',can_cancel:true,can_return:true}],error:null} as never)
      .mockResolvedValueOnce({data:{id:'active-1',status:'RETURNED'},error:null} as never)
      .mockResolvedValueOnce({data:[],error:null} as never)
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AccountKeyRequestHistoryPage/></QueryClientProvider>)
    const returnButton=await screen.findByRole('button',{name:'ยืนยันการคืนกุญแจ'})
    expect(returnButton.closest('footer')).toHaveClass('equal-actions')
    fireEvent.click(returnButton)
    fireEvent.click(screen.getAllByRole('button',{name:'ยืนยันการคืนกุญแจ'}).at(-1)!)

    await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledWith('return_my_key_request',{p_key_request_id:'active-1'}))
    await waitFor(()=>expect(supabase.rpc).toHaveBeenCalledTimes(3))
  })

  it('styles a cancelled history status as muted', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({data:[{id:'cancelled-1',request_code:'KR-3',room_code:'S2407',room_name:'ห้อง S2407',room_type_name:'ห้องปฏิบัติการ',floor:'4',starts_at:'2026-11-08T13:00:00+07:00',ends_at:'2026-11-08T14:00:00+07:00',purpose:'ทดสอบ',purpose_type:'OTHER',course_code:null,lecturer_name:null,status:'CANCELLED',can_cancel:false}],error:null} as never)
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><AccountKeyRequestHistoryPage/></QueryClientProvider>)
    expect(await screen.findByText('ยกเลิกแล้ว')).toHaveClass('muted')
  })

  it('presents the university login form when there is no session', async () => {
    renderPath('/login')

    expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument()
    expect(screen.getByLabelText('อีเมล')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Remember Me' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Log In' })).toBeInTheDocument()
    expect(screen.getByText('Forgot Password')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Login with Google' })).toBeEnabled()
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

  it('redirects the retired root route to the key catalog', async () => {
    renderPath('/')
    expect(await screen.findByRole('heading', { name: 'เลือกกุญแจที่ต้องการเบิก' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'IT KeySpace' })).toBeInTheDocument()
    expect(screen.queryByText(/แผนผังห้อง อาคารเรียน ชั้น 4/)).not.toBeInTheDocument()
  })

  it('opens the dedicated key-request entry without a service picker', async () => {
    renderPath('/keys')
    expect(await screen.findByRole('heading', { name: 'เลือกกุญแจที่ต้องการเบิก' })).toBeInTheDocument()
    expect(screen.getByRole('img',{name:'IT KeySpace'})).toBeInTheDocument()
    expect(document.querySelector('.public-sidebar.key-mode')).not.toBeInTheDocument()
    expect(screen.getByText('แตะกุญแจที่ต้องการเพื่อเบิก หรือกดดูรายละเอียด')).toBeInTheDocument()
    expect(screen.queryByText('เลือกบริการที่ต้องการ')).not.toBeInTheDocument()
  })

  it('maps the legacy cloud catalog to laboratory and special-room cards', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [
      { id: 'lab-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการ S2407', room_type_name: 'Computer Room', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true },
      { id: 'special-1', code: 'STUDIO', layout_key: 'STUDIO', name: 'Studio', room_type_name: 'Studio Room', building: 'อาคาร 2', floor: '4', capacity: 10, active: true, academic_schedule_confirmed: true },
      { id: 'meeting-1', code: 'MEETING-ROOM', layout_key: 'MEET-FACULTY', name: 'ห้องประชุม', room_type_name: 'Meeting Room', building: 'อาคาร 2', floor: '4', capacity: 10, active: true, academic_schedule_confirmed: true },
    ], error: null } as never)
    renderPath('/keys')
    expect((await screen.findAllByRole('link', { name: /S2407/ })).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'ห้องปฏิบัติการพิเศษ' }))
    expect(screen.getAllByRole('link', { name: /STUDIO/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /MEETING-ROOM/ })).not.toBeInTheDocument()
  })

  it('opens a meeting-room detail and requires login before requesting the room', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'meeting-1', code: 'MEETING-ROOM', name: 'MEETING-ROOM', room_type_name: 'Meeting Room', building: 'อาคาร 2', floor: '4', capacity: 10, active: true, usage_scope: 'MEETING' }], error: null } as never)

    renderPath('/meeting-room/meeting-1')

    expect(await screen.findByRole('heading', { name: 'ห้องประชุมคณะ IT' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '← กลับ' })).not.toBeInTheDocument()
    expect(screen.getByText('Meeting Room')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'IT KeySpace' }).closest('a')).toHaveAttribute('href', '/meeting-room')
    expect(screen.queryByRole('link', { name: 'ภาพรวม' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'รายการจองห้องประชุม' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /08:00.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: /08:30.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: 'จองห้องนี้' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('กรุณาเข้าสู่ระบบ')
  })

  it('uses the authenticated meeting-room booking form and review flow', async () => {
    const payload = btoa(JSON.stringify({ iat: Math.floor(Date.now() / 1000) }))
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: { access_token: `x.${payload}.x`, user: { id: 'staff-1', user_metadata: {} } } }, error: null } as never)
    vi.mocked(supabase.from).mockImplementation(((table: string) => {
      if (table === 'profiles') { const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }; query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.single.mockResolvedValue({ data: { id: 'staff-1', full_name: 'ปิติพัฒน์ เงินบุรุษเพชร', email: 'pitiphat.jo@northbkk.ac.th', account_status: 'ACTIVE' }, error: null }); return query }
      if (table === 'user_roles') { const query = { select: vi.fn(), eq: vi.fn() }; query.select.mockReturnValue(query); query.eq.mockResolvedValue({ data: [], error: null }); return query }
      return { select: vi.fn() }
    }) as never)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'meeting-1', code: 'MEETING-ROOM', name: 'MEETING-ROOM', room_type_name: 'Meeting Room', capacity: 10, active: true, usage_scope: 'MEETING' }], error: null } as never)

    renderPath('/meeting-room/meeting-1/request?date=2026-11-09&start=12:30&end=14:00')

    expect(await screen.findByRole('heading', { name: 'แบบฟอร์มการจองห้องประชุม' })).toBeInTheDocument()
    expect(screen.queryByText('สถานะ')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(screen.getByLabelText('วันที่จอง')).toHaveValue('2026-11-09')
    const requesterId = screen.getByLabelText('รหัสผู้ใช้งาน')
    expect(requesterId).not.toHaveAttribute('readonly')
    expect(requesterId).toHaveValue('')
    fireEvent.change(requesterId, { target: { value: '9876541' } })
    fireEvent.click(screen.getByRole('button', { name: 'เวลาเริ่มต้น 12:30' }))
    expect(screen.getByRole('listbox', { name: 'ตัวเลือกเวลาเริ่มต้น' })).toHaveClass('placement-top')
    fireEvent.change(screen.getByLabelText('ระบุวัตถุประสงค์'), { target: { value: 'นัดพรีเซนต์งานนักศึกษา' } })
    fireEvent.click(screen.getByRole('button', { name: /ถัดไป/ }))
    expect(await screen.findByRole('heading', { name: 'ตรวจสอบข้อมูล' })).toBeInTheDocument()
    expect(screen.getByText('ข้อมูลการจอง')).toBeInTheDocument()
    expect(screen.getByText('9876541')).toBeInTheDocument()
    expect(screen.getByText('นัดพรีเซนต์งานนักศึกษา')).toBeInTheDocument()
    expect(screen.getByText('ห้องประชุมคณะ IT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ยืนยันการจอง' })).toHaveClass('review-confirm-action')
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'BOOKING_ROLE_REQUIRED' } } as never)
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการจอง' }))
    expect(await screen.findByRole('dialog', { name: 'ไม่สามารถจองห้องได้' })).toHaveTextContent('บัญชีนี้ไม่มีสิทธิ์จองห้องประชุม กรุณาใช้บัญชีอาจารย์')
    expect(supabase.rpc).toHaveBeenCalledWith('create_booking', expect.objectContaining({ p_room_id: 'meeting-1', p_purpose: 'นัดพรีเซนต์งานนักศึกษา', p_requires_key: true }))
  })

  it('hides elapsed meeting-room times for today but keeps them for a future date', () => {
    const now = new Date('2026-11-08T12:05:00+07:00')
    expect(meetingTimeOptions('2026-11-08', now)).not.toContain('12:00')
    expect(meetingTimeOptions('2026-11-08', now)[0]).toBe('12:30')
    expect(meetingTimeOptions('2026-11-09', now)[0]).toBe('08:00')
  })

  it('separates general and special laboratories into catalog tabs', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [
      { id: 'lab-1', code: 'S2407', name: 'ห้องปฏิบัติการ S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false },
      { id: 'special-1', code: 'STUDIO', name: 'Studio', room_type_name: 'Studio Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: true },
    ], error: null } as never)
    renderPath('/keys')
    expect(await screen.findByRole('tab', { name: 'ห้องปฏิบัติการ' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('link', { name: /S2407/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /STUDIO/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'ห้องปฏิบัติการพิเศษ' }))
    expect(screen.getAllByRole('link', { name: /STUDIO/ }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /S2407/ })).not.toBeInTheDocument()
  })

  it('offers separate detail and key-request actions on a room card', async () => {
    vi.setSystemTime(new Date('2026-11-08T13:20:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้องปฏิบัติการ S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys')
    expect(await screen.findByRole('link', { name: 'ดูรายละเอียด S2407' })).toHaveAttribute('href', '/keys/rooms/room-1')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจ S2407' })).toHaveAttribute('href', expect.stringContaining('/request'))
  })

  it('presents the mobile key catalog structure and real schedule rows', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'LAB-42', name: 'ห้องปฏิบัติการเครือข่าย', room_type_name: 'Computer Room', building: 'อาคาร 2', floor: '4', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'event-1', event_type: 'CLASS', title: 'อ. สมชาย · NET401', starts_at: '2026-11-08T09:00:00+07:00', ends_at: '2026-11-08T12:00:00+07:00', status: 'ACTIVE' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)

    const { container } = renderPath('/keys')

    expect(await screen.findByRole('heading', { name: 'เลือกกุญแจที่ต้องการเบิก' })).toBeInTheDocument()
    expect(screen.getByText('แตะกุญแจที่ต้องการเพื่อเบิก หรือกดดูรายละเอียด')).toBeInTheDocument()
    expect(container.querySelector('.key-room-catalog-page')).toBeInTheDocument()
    expect(screen.getByText('LAB-42')).toBeInTheDocument()
    expect(await screen.findByText('อ. สมชาย · NET401')).toBeInTheDocument()
    expect(screen.getByText('09:00–12:00 น.')).toBeInTheDocument()
  })

  it('shows requester role, name, and purpose from the public key-request event', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [
        { id: 'student-request', event_type: 'BOOKING', title: 'นศ. ธนบัตร · พรีเซนต์โปรเจค', starts_at: '2026-11-08T14:30:00+07:00', ends_at: '2026-11-08T16:30:00+07:00', status: 'APPROVED' },
        { id: 'teacher-request', event_type: 'BOOKING', title: 'อ. พลวัต · SOC401', starts_at: '2026-11-08T09:00:00+07:00', ends_at: '2026-11-08T12:00:00+07:00', status: 'APPROVED' },
      ], error: null } as never
      return { data: [], error: null } as never
    }) as never)

    renderPath('/keys')

    expect(await screen.findByText('นศ. ธนบัตร · พรีเซนต์โปรเจค')).toBeInTheDocument()
    expect(screen.getByText('อ. พลวัต · SOC401')).toBeInTheDocument()
  })

  it('marks a fully occupied room as having no available time', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2408', name: 'ห้องปฏิบัติการ S2408', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'event-1', event_type: 'BOOKING', title: 'เต็มวัน', starts_at: '2026-11-08T08:00:00+07:00', ends_at: '2026-11-08T18:00:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys')
    expect(await screen.findByText('• ไม่มีช่วงเวลาว่าง')).toHaveClass('unavailable')
    expect(screen.getByRole('button', { name: 'เบิกกุญแจ S2408' })).toBeDisabled()
  })

  it('starts a same-day request at the next currently available half-hour', async () => {
    vi.setSystemTime(new Date('2026-11-08T13:20:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [], error: null } as never
      return { data: [], error: null } as never
    }) as never)

    renderPath('/keys')

    expect(await screen.findByText('13:30–18:00 น.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'เบิกกุญแจ S2407' })).toHaveAttribute('href', expect.stringContaining('start=13:30&end=14:00'))
  })

  it('keeps the request action disabled for an inactive room', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-closed', code: 'S2412', name: 'ห้องปฏิบัติการ S2412', room_type_name: 'Computer Room', active: false, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      return { data: [], error: null } as never
    }) as never)

    renderPath('/keys')

    expect(await screen.findByText('• ไม่พร้อมใช้')).toHaveClass('unavailable')
    expect(screen.getByRole('button', { name: 'เบิกกุญแจ S2412' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2412' })).toBeInTheDocument()
  })

  it('opens Google SSO in a modal for a special-room key request', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'special-1', code: 'STUDIO', name: 'Studio', room_type_name: 'Studio Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: true }], error: null } as never)
    renderPath('/keys')
    fireEvent.click(await screen.findByRole('tab', { name: 'ห้องปฏิบัติการพิเศษ' }))
    fireEvent.click(screen.getByRole('button', { name: 'เบิกกุญแจ STUDIO' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('กรุณาเข้าสู่ระบบ')
    expect(screen.getByRole('dialog').closest('.key-room-card')).toBeNull()
    expect(document.querySelector('.google-logo')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('IT KeySpace')
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบด้วย Google/ }))
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: `${window.location.origin}/login?returnTo=${encodeURIComponent('/keys/rooms/special-1/request?date=2026-11-08&start=08:00&end=08:30')}`,
      }),
    })
  })

  it('opens room details before the anonymous key-request form', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'ห้องทั่วไป', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1')
    expect(await screen.findByRole('heading', { name: 'ห้อง S2407' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'รายการผู้เบิกกุญแจ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /08:00.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: /09:00.*ว่าง/ }))
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('href', expect.stringContaining('/request'))
  })

  it('shows honest fallbacks when room media and equipment data are unavailable', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'Computer Room', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)

    renderPath('/keys/rooms/room-1')

    expect(await screen.findByAltText('ภาพห้อง S2407')).toBeInTheDocument()
    expect(screen.getByText('ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม')).toBeInTheDocument()
    expect(screen.queryByText(/ไมโครโฟน/)).not.toBeInTheDocument()
  })

  it('marks elapsed slots as unavailable for the current afternoon in room details', async () => {
    vi.setSystemTime(new Date('2026-11-08T14:00:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'Computer Room', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_key_request_history') return { data: [{ id: 'req-1', requester_name: 'นศ. Sufeeyan Taleh · เปิดห้องเพื่อการเรียนการสอน', starts_at: '2026-11-08T14:30:00+07:00', ends_at: '2026-11-08T15:00:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)

    renderPath('/keys/rooms/room-1')

    expect(await screen.findByRole('heading', { name: 'ห้อง S2407' })).toBeInTheDocument()
    expect(await screen.findByText('นศ. Sufeeyan Taleh · เปิดห้องเพื่อการเรียนการสอน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /08:00.*ไม่ว่าง/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /08:00.*ไม่ว่าง/ })).toHaveClass('unavailable')
    expect(screen.getByRole('button', { name: /13:30.*ไม่ว่าง/ })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: /14:00.*ว่าง/ })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByRole('button', { name: /15:00.*ว่าง/ })).toHaveAttribute('aria-disabled', 'false')
  })

  it('keeps ten key-request history rows in a three-row scroll area', async () => {
    const historyRows = Array.from({ length: 10 }, (_, index) => ({
      id: `req-${index + 1}`,
      requester_name: `นศ. ผู้ทดสอบ ${index + 1}`,
      starts_at: `2026-11-08T${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}:00+07:00`,
      ends_at: `2026-11-08T${String(8 + Math.floor((index + 1) / 2)).padStart(2, '0')}:${(index + 1) % 2 ? '30' : '00'}:00+07:00`,
      status: 'APPROVED',
    }))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_key_request_history') return { data: historyRows, error: null } as never
      return { data: [], error: null } as never
    }) as never)

    renderPath('/keys/rooms/room-1')

    const list = await screen.findByRole('list', { name: 'รายการผู้เบิกกุญแจทั้งหมด' })
    expect(list).toHaveClass('key-history-scroll')
    expect(list.querySelectorAll('li')).toHaveLength(10)
  })

  it('opens an anonymous key-request form for a general laboratory', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'ห้องทั่วไป', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    expect(await screen.findByRole('heading', { name: 'แบบฟอร์มการเบิกกุญแจ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /สถานะ.*นักศึกษา/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('รหัสนักศึกษา / บุคลากร')).toBeInTheDocument()
    expect(screen.getByLabelText('อีเมล')).toHaveAttribute('placeholder', 'name@northbkk.ac.th')
    expect(screen.getByRole('button', { name: 'ถัดไป' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ย้อนกลับ' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'เข้าสู่ระบบ' })).not.toBeInTheDocument()
  })

  it('starts without a purpose and hides conditional purpose fields', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')

    expect(await screen.findByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'อื่นๆ' })).not.toBeChecked()
    expect(screen.queryByLabelText('รหัสวิชา')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('ระบุวัตถุประสงค์')).not.toBeInTheDocument()
  })

  it('selects a lecturer without changing the manually entered course code', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_key_request_options') return { data: [{ id: 'course-1', course_code: 'ITD336', course_name: 'การพัฒนาเว็บแอปพลิเคชัน', lecturer_name: 'อ. พสวัตน์' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1/request')

    fireEvent.click(await screen.findByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))
    fireEvent.change(screen.getByLabelText('รหัสวิชา'), { target: { value: 'SOC401' } })
    fireEvent.click(screen.getByRole('button', { name: /อาจารย์ผู้สอน.*กรุณาเลือกชื่ออาจารย์ผู้สอน/ }))
    fireEvent.click(screen.getByRole('option', { name: 'อ. พสวัตน์' }))

    expect(screen.getByLabelText('รหัสวิชา')).toHaveValue('SOC401')
    expect(screen.getByRole('button', { name: /อาจารย์ผู้สอน.*อ. พสวัตน์/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('อีเมลอาจารย์')).not.toBeInTheDocument()
  })

  it('uses upward shared dropdowns for key-request times', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request?start=14:30&end=15:00')

    fireEvent.click(await screen.findByRole('button', { name: 'เวลาเริ่มต้น 14:30' }))
    expect(screen.getByRole('listbox', { name: 'ตัวเลือกเวลาเริ่มต้น' })).toHaveClass('placement-top')
    fireEvent.click(screen.getByRole('option', { name: '15:00' }))
    expect(screen.getByRole('button', { name: 'เวลาเริ่มต้น 15:00' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('requires a mapped course for a teacher teaching request', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')

    fireEvent.click(await screen.findByRole('button', { name: /สถานะ.*นักศึกษา/ }))
    fireEvent.click(screen.getByRole('option', { name: 'อาจารย์' }))
    fireEvent.click(screen.getByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))

    expect(screen.getByLabelText('รหัสวิชา')).toBeInTheDocument()
    expect(screen.queryByLabelText('อาจารย์ผู้สอน')).not.toBeInTheDocument()
  })

  it('opens the custom requester-status list and selects a teacher', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    const trigger = await screen.findByRole('button', { name: /สถานะ.*นักศึกษา/ })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger.querySelector('.key-select-arrow')).toHaveAttribute('data-direction', 'up')
    fireEvent.click(screen.getByRole('option', { name: 'อาจารย์' }))
    expect(screen.getByRole('button', { name: /สถานะ.*อาจารย์/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('marks the request date as read-only', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    expect(await screen.findByRole('heading', { name: 'เวลาที่เบิกกุญแจ' })).toBeInTheDocument()
    expect(screen.queryByLabelText('วันที่เบิก')).not.toBeInTheDocument()
  })

  it('uses the shared custom dropdown for requester status and course selection', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_key_request_options') return { data: [{ id: 'course-1', course_code: 'ITD336', course_name: 'การพัฒนาเว็บแอปพลิเคชัน', lecturer_name: 'อ. พสวัตน์' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.click(await screen.findByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))
    expect(screen.getByLabelText('รหัสวิชา')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /อาจารย์ผู้สอน.*กรุณาเลือกชื่ออาจารย์ผู้สอน/ }))
    expect(screen.getByRole('option', { name: 'อ. พสวัตน์' })).toBeInTheDocument()
  })

  it('asks a teacher to select a course without showing lecturer fields', async () => {
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_key_request_options') return { data: [{ id: 'course-1', course_code: 'ITD336', course_name: 'การพัฒนาเว็บแอปพลิเคชัน', lecturer_name: 'อ. พสวัตน์' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.click(await screen.findByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))
    fireEvent.click(screen.getByRole('button', { name: /สถานะ.*นักศึกษา/ }))
    fireEvent.click(screen.getByRole('option', { name: 'อาจารย์' }))
    expect(screen.getByLabelText('รหัสวิชา')).toBeInTheDocument()
    expect(screen.queryByLabelText('อาจารย์ผู้สอน')).not.toBeInTheDocument()
  })

  it('reviews an anonymous key request before sending it', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'ห้องทั่วไป', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.change(await screen.findByLabelText('ชื่อ–นามสกุล'), { target: { value: 'นักศึกษาทดสอบ' } })
    fireEvent.change(screen.getByLabelText('รหัสนักศึกษา / บุคลากร'), { target: { value: '661198765' } })
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'student@northbkk.ac.th' } })
    fireEvent.click(screen.getByRole('radio', { name: 'อื่นๆ' }))
    fireEvent.change(screen.getByLabelText('ระบุวัตถุประสงค์'), { target: { value: 'ทำโครงงาน' } })
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    expect(await screen.findByRole('heading', { name: 'ตรวจสอบข้อมูล' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ข้อมูลผู้เบิกกุญแจ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ข้อมูลการเบิก' })).toBeInTheDocument()
    expect(document.querySelectorAll('.key-review-icon')).toHaveLength(2)
    expect(document.querySelector('.key-review-actions')).toHaveClass('key-review-actions')
    expect(screen.getByText('661198765')).toBeInTheDocument()
    expect(screen.getByText('S2407')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ยืนยันการเบิก' })).toHaveClass('primary-action', 'review-confirm-action')
    expect(screen.getByText('student@northbkk.ac.th')).toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalledWith('create_key_request_v2', expect.anything())
  })

  it('shows the completed key-request details in the success card', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as never)
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'create_key_request_v2') return { data: { id: 'request-1', request_code: 'KR-001', status: 'APPROVED' }, error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.change(await screen.findByLabelText('รหัสนักศึกษา / บุคลากร'), { target: { value: '661198765' } })
    fireEvent.change(screen.getByLabelText('ชื่อ–นามสกุล'), { target: { value: 'นักศึกษาทดสอบ' } })
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'student@northbkk.ac.th' } })
    fireEvent.click(screen.getByRole('radio', { name: 'อื่นๆ' }))
    fireEvent.change(screen.getByLabelText('ระบุวัตถุประสงค์'), { target: { value: 'ทำโครงงาน' } })
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    fireEvent.click(await screen.findByRole('button', { name: 'ยืนยันการเบิก' }))
    expect(await screen.findByRole('heading', { name: 'ส่งคำขอเบิกกุญแจสำเร็จ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'รายละเอียดการเบิกกุญแจ' })).toBeInTheDocument()
    expect(screen.getByText('S2407')).toBeInTheDocument()
    expect(screen.getByText(/กรุณาติดต่อรับกุญแจจากเจ้าหน้าที่/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'กลับสู่หน้าหลัก' })).toHaveClass('primary-action')
    fireEvent.click(screen.getByRole('link', { name: 'กลับสู่หน้าหลัก' }))
    await screen.findByRole('heading', { name: 'เลือกกุญแจที่ต้องการเบิก' })
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'get_public_room_catalog')).toHaveLength(2))
  })

  it('shows the pending-approval result from the backend without claiming approval', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: null } as never)
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'STUDIO', name: 'ห้อง Studio', room_type_name: 'Studio Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'create_key_request_v2') return { data: { id: 'request-2', request_code: 'KR-002', status: 'PENDING_APPROVAL' }, error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.change(await screen.findByLabelText('รหัสนักศึกษา / บุคลากร'), { target: { value: '661198765' } })
    fireEvent.change(screen.getByLabelText('ชื่อ–นามสกุล'), { target: { value: 'นักศึกษาทดสอบ' } })
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'student@northbkk.ac.th' } })
    fireEvent.click(screen.getByRole('radio', { name: 'อื่นๆ' }))
    fireEvent.change(screen.getByLabelText('ระบุวัตถุประสงค์'), { target: { value: 'กิจกรรมชมรม' } })
    fireEvent.click(screen.getByRole('button', { name: 'ถัดไป' }))
    fireEvent.click(await screen.findByRole('button', { name: 'ยืนยันการเบิก' }))

    expect(await screen.findByRole('heading', { name: 'ส่งคำขอเบิกกุญแจเรียบร้อยแล้ว' })).toBeInTheDocument()
    expect(screen.getByText(/รอเจ้าหน้าที่ตรวจสอบและอนุมัติ/)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ส่งคำขอเบิกกุญแจสำเร็จ' })).not.toBeInTheDocument()
  })

  it('waits for session resolution before deciding access to a key-request form', async () => {
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(new Promise(() => {}) as never)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-special', code: 'STUDIO', layout_key: 'STUDIO', name: 'ห้อง Studio', room_type_name: 'ห้องพิเศษ', building: 'อาคาร 2', floor: '4', capacity: 10, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: true }], error: null } as never)
    renderPath('/keys/rooms/room-special/request')
    expect(await screen.findByRole('status')).toHaveTextContent('กำลังตรวจสอบบัญชี…')
    expect(screen.queryByRole('heading', { name: 'ห้องนี้ต้องเข้าสู่ระบบ' })).not.toBeInTheDocument()
  })

  it('keeps the special-room deep link when sending a guest to login', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-special', code: 'STUDIO', layout_key: 'STUDIO', name: 'ห้อง Studio', room_type_name: 'ห้องพิเศษ', building: 'อาคาร 2', floor: '4', capacity: 10, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: true }], error: null } as never)
    renderPath('/keys/rooms/room-special/request')
    expect(await screen.findByRole('link', { name: 'เข้าสู่ระบบมหาวิทยาลัย' })).toHaveAttribute('href', '/login?returnTo=%2Fkeys%2Frooms%2Froom-special%2Frequest')
  })

  it('collects every database-required teaching field', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', layout_key: 'S2407', name: 'ห้องปฏิบัติการคอมพิวเตอร์', room_type_name: 'ห้องทั่วไป', building: 'อาคาร 2', floor: '4', capacity: 30, active: true, academic_schedule_confirmed: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.click(await screen.findByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))
    expect(screen.getByLabelText('รหัสวิชา')).toBeInTheDocument()
    expect(screen.queryByLabelText('ระบุวัตถุประสงค์')).not.toBeInTheDocument()
  })

  it('shows purpose details only for the other-purpose option', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')
    fireEvent.click(await screen.findByRole('radio', { name: 'อื่นๆ' }))
    const details = screen.getByLabelText('ระบุวัตถุประสงค์')
    fireEvent.change(details, { target: { value: 'ประชุมโครงงาน' } })
    fireEvent.click(screen.getByRole('radio', { name: 'เพื่อเปิดห้องการเรียนการสอน' }))
    expect(screen.queryByLabelText('ระบุวัตถุประสงค์')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'อื่นๆ' }))
    expect(screen.getByLabelText('ระบุวัตถุประสงค์')).toHaveValue('ประชุมโครงงาน')
  })

  it('uses aligned section headings and a stacked other-purpose field', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1/request')

    expect(await screen.findByRole('heading', { name: 'ข้อมูลผู้เบิกกุญแจ' })).toHaveClass('key-section-heading')
    expect(screen.getByText('วัตถุประสงค์').closest('legend')).toHaveClass('key-section-heading')
    expect(screen.getByRole('heading', { name: 'เวลาที่เบิกกุญแจ' })).toHaveClass('key-section-heading')

    fireEvent.click(screen.getByRole('radio', { name: 'อื่นๆ' }))
    const purpose = screen.getByLabelText('ระบุวัตถุประสงค์')
    expect(purpose.closest('.key-other-purpose-field')).toBeInTheDocument()
    expect(screen.getByText('ระบุวัตถุประสงค์ *', { selector: 'label' })).toBeInTheDocument()
  })

  it('selects a start and end slot with two normal clicks', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1')
    const slot = await screen.findByRole('button', { name: /11:30.*ว่าง/ })
    fireEvent.click(slot)
    expect(screen.getByText('กรุณาเลือก')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /12:00.*ว่าง/ }))
    expect(screen.getByRole('button', { name: /12:00.*เลือก/ })).toHaveClass('selected')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('href', expect.stringMatching(/start=11%3A30|start=11:30/))
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('href', expect.stringMatching(/end=12%3A00|end=12:00/))
  })

  it('labels range boundaries and clears the selection from the reset action', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1')

    fireEvent.click(await screen.findByRole('button', { name: /11:30.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: /12:30.*ว่าง/ }))

    expect(screen.getByRole('button', { name: /11:30.*เลือก - เริ่ม/ })).toHaveClass('selected')
    expect(screen.getByRole('button', { name: /12:30.*เลือก - จบ/ })).toHaveClass('selected')
    fireEvent.click(screen.getByRole('button', { name: 'เลือกช่วงเวลาใหม่' }))
    expect(screen.queryByText('เวลาเริ่มต้น')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('allows the final 17:30–18:00 operating-hours range', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1')
    fireEvent.click(await screen.findByRole('button', { name: /17:30.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: /18:00.*ว่าง/ }))
    expect(screen.getByRole('button', { name: /18:00.*เลือก/ })).toHaveClass('selected')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('href', expect.stringMatching(/end=18%3A00|end=18:00/))
  })

  it('marks 18:00 unavailable when the final half-hour is occupied', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'busy-1', event_type: 'BOOKING', title: 'ไม่ว่าง', starts_at: '2026-11-08T17:30:00+07:00', ends_at: '2026-11-08T18:00:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1')
    expect(await screen.findByRole('button', { name: /18:00.*ไม่ว่าง/ })).toHaveClass('unavailable')
  })

  it('keeps the schedule title and date in one heading row', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never)
    renderPath('/keys/rooms/room-1')
    const heading = await screen.findByTestId('key-schedule-heading')
    expect(heading).toHaveTextContent('ตารางเวลาการเบิกกุญแจ')
    expect(heading).toHaveTextContent('2026-11-08')
  })

  it('does not select a range across an occupied slot', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'busy-1', event_type: 'BOOKING', title: 'ไม่ว่าง', starts_at: '2026-11-08T10:30:00+07:00', ends_at: '2026-11-08T11:30:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1')
    fireEvent.click(await screen.findByRole('button', { name: /10:00.*ว่าง/ }))
    fireEvent.click(screen.getByRole('button', { name: /11:30.*ว่าง/ }))
    expect(screen.getByRole('button', { name: /11:30.*ว่าง/ })).not.toHaveClass('selected')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('ไม่สามารถเลือกช่วงเวลานี้ได้ เนื่องจากมีรายการใช้งานห้องคั่นอยู่')
  })

  it('shows a warning when an occupied slot is tapped', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'busy-1', event_type: 'BOOKING', title: 'ไม่ว่าง', starts_at: '2026-11-08T10:30:00+07:00', ends_at: '2026-11-08T11:30:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1')
    fireEvent.click(await screen.findByRole('button', { name: /10:30.*ไม่ว่าง/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('ช่วงเวลานี้ไม่ว่าง กรุณาเลือกเวลาอื่น')
  })

  it('clears the selected start when the same slot is tapped again', async () => {
    vi.setSystemTime(new Date('2026-11-08T07:30:00+07:00'))
    vi.mocked(supabase.rpc).mockImplementation((async (name: string) => {
      if (name === 'get_public_room_catalog') return { data: [{ id: 'room-1', code: 'S2407', name: 'ห้อง S2407', room_type_name: 'Computer Room', active: true, usage_scope: 'LABORATORY', requires_sso_for_key_request: false }], error: null } as never
      if (name === 'get_public_room_schedule_events') return { data: [{ id: 'busy-1', event_type: 'BOOKING', title: 'ไม่ว่าง', starts_at: '2026-11-08T13:00:00+07:00', ends_at: '2026-11-08T14:00:00+07:00', status: 'APPROVED' }], error: null } as never
      return { data: [], error: null } as never
    }) as never)
    renderPath('/keys/rooms/room-1')
    const startSlot = await screen.findByRole('button', { name: /11:30.*ว่าง/ })
    fireEvent.click(startSlot)
    fireEvent.click(screen.getByRole('button', { name: /14:00.*ว่าง/ }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /11:30.*เลือก/ }))
    expect(screen.queryByText('เวลาเริ่มต้น')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /11:30.*ว่าง/ })).not.toHaveClass('selected')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจห้องนี้' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('uses the shared key header without the retired public sidebar', () => {
    const identity = { userId: 'user-1', fullName: 'นักศึกษาทดสอบ', email: 'student@example.test', role: 'STUDENT' as const }
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><Routes><Route element={<PublicLayout identity={identity} loading={false} onLogout={vi.fn()} />}><Route index element={<div>หน้าแรก</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    expect(screen.getByRole('img', { name: 'IT KeySpace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เปิดเมนูผู้ใช้' })).toBeInTheDocument()
    expect(document.querySelector('.public-sidebar')).not.toBeInTheDocument()
  })

  it('shows the branded key header with account identity and an outline notification bell', () => {
    const identity = { userId: 'user-1', fullName: 'นายปิติพัฒน์ ชื่อยาวสำหรับทดสอบ', email: 'pitiphat.jo@northbkk.ac.th', role: 'TEACHER' as const, avatarUrl: 'https://example.test/avatar.png' }
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
    client.setQueryData(['notifications','unread'],[{id:'notice-1'}])
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/keys']}><Routes><Route element={<PublicLayout identity={identity} loading={false} onLogout={vi.fn()} />}><Route path="keys" element={<div>หน้ากุญแจ</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    expect(screen.getByRole('img',{name:'IT KeySpace'})).toHaveAttribute('src',expect.stringContaining('.ico'))
    expect(screen.getByRole('img',{name:'รูปโปรไฟล์ของ นายปิติพัฒน์ ชื่อยาวสำหรับทดสอบ'})).toHaveAttribute('src','https://example.test/avatar.png')
    expect(screen.getByText('นายปิติพัฒน์')).toHaveClass('key-account-name')
    expect(screen.getByText('อาจารย์')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/การแจ้งเตือน/}).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByTestId('notification-dot')).toBeInTheDocument()
    fireEvent.error(screen.getByRole('img',{name:'รูปโปรไฟล์ของ นายปิติพัฒน์ ชื่อยาวสำหรับทดสอบ'}))
    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument()
  })

  it('shows a neutral fallback avatar before login', () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/keys']}><Routes><Route element={<PublicLayout identity={null} loading={false} onLogout={vi.fn()} />}><Route path="keys" element={<div>หน้ากุญแจ</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    expect(screen.getByTestId('guest-avatar')).toHaveClass('guest')
  })

  it('reuses the person avatar and gradient action on the account profile', () => {
    const identity = { userId: 'user-1', fullName: 'Sufeeyan Taleh', givenName: 'Sufeeyan', email: 'sufeeyan.tale@northbkk.ac.th', role: 'STUDENT' as const }
    render(<MemoryRouter><AccountProfilePage identity={identity}/></MemoryRouter>)
    expect(screen.getByTestId('profile-person-icon').querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('link',{name:'ดูประวัติการทำรายการ'})).toHaveClass('profile-history-action')
  })

  it('shows the account email when the authenticated display name is blank', () => {
    const identity = { userId: 'user-1', fullName: '   ', email: 'sufeeyan.tale@northbkk.ac.th', role: null }
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/keys']}><Routes><Route element={<PublicLayout identity={identity} loading={false} onLogout={vi.fn()} />}><Route path="keys" element={<div>หน้ากุญแจ</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)

    expect(screen.getByText('sufeeyan.tale')).toHaveClass('key-account-name')
    expect(screen.getByText('ยังไม่ได้กำหนดบทบาท')).toHaveClass('key-account-role')
  })

  it('keeps the current key-request path when a guest signs in from the user menu', () => {
    const returnTo='/keys/rooms/room-1/request?date=2026-11-08&start=17:30&end=18:00'
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[returnTo]}><Routes><Route element={<PublicLayout identity={null} loading={false} onLogout={vi.fn()} />}><Route path="keys/rooms/:roomId/request" element={<div>หน้ากุญแจ</div>} /></Route></Routes></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนูผู้ใช้' }))
    expect(screen.getByRole('dialog', { name: 'เมนูผู้ใช้' })).toBeInTheDocument()
    expect(screen.getByRole('link',{name:'หน้าหลัก'})).toHaveAttribute('href','/keys')
    fireEvent.click(screen.getByRole('button', { name: 'โปรไฟล์ผู้ใช้' }))
    expect(screen.getByRole('dialog', { name: 'กรุณาเข้าสู่ระบบ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /เข้าสู่ระบบด้วย Google/ }))
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({redirectTo:`${window.location.origin}/login?returnTo=${encodeURIComponent(returnTo)}`})}))
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

  it('creates a laboratory key request through the new authoritative RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'request-1', request_code: 'KR-001', status: 'APPROVED' }, error: null } as never)
    await createKeyRequest({
      roomId: 'room-1', requesterName: 'นักศึกษาทดสอบ', requesterEmail: 'student@northbkk.ac.th',
      purposeType: 'OTHER', purpose: 'ทำโครงงาน', startsAt: '2026-11-09T09:00:00+07:00', endsAt: '2026-11-09T10:00:00+07:00',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('create_key_request', {
      p_room_id: 'room-1', p_requester_name: 'นักศึกษาทดสอบ', p_requester_email: 'student@northbkk.ac.th',
      p_purpose_type: 'OTHER', p_purpose: 'ทำโครงงาน', p_starts_at: '2026-11-09T09:00:00+07:00', p_ends_at: '2026-11-09T10:00:00+07:00',
      p_course_code: null, p_course_name: null, p_lecturer_name: null, p_lecturer_email: null,
    })
  })

  it('translates a rejected university email into a safe message', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'UNIVERSITY_EMAIL_REQUIRED' } } as never)
    await expect(createKeyRequest({
      roomId: 'room-1', requesterName: 'ผู้ใช้ทดสอบ', requesterEmail: 'guest@example.com',
      purposeType: 'OTHER', purpose: 'ทดสอบ', startsAt: '2026-11-09T09:00:00+07:00', endsAt: '2026-11-09T10:00:00+07:00',
    })).rejects.toThrow('กรุณาใช้อีเมลมหาวิทยาลัย @northbkk.ac.th')
  })

  it('labels a late user-reported return for the administrator', () => {
    expect(keyStatusLabel({status:'RETURN_REPORTED',returnedLate:true} as never)).toBe('คืนกุญแจช้ากว่ากำหนด')
    expect(keyStatusLabel({status:'RETURN_REPORTED',returnedLate:false} as never)).toBe('คืนกุญแจ')
  })

  it('distinguishes overdue keys from active checkouts and closed rooms', () => {
    expect(keyCabinetLabels.CHECKED_OUT).toBe('มีผู้ถือกุญแจ')
    expect(keyCabinetLabels.OVERDUE).toBe('เกินกำหนดคืนกุญแจ')
    expect(keyCabinetLabels.ROOM_CLOSED).toBe('ห้องปิดใช้งาน')
  })

  it('shows the borrower name and university id with a safe fallback', () => {
    expect(getBorrowerIdentity({borrower_id:'cfdba773-0000',borrowerName:'นักศึกษาทดสอบ',borrowerUniversityId:'66010001',borrowerEmail:'student@example.test'})).toEqual({name:'นักศึกษาทดสอบ',identifier:'66010001'})
    expect(getBorrowerIdentity({borrower_id:'cfdba773-0000',borrowerName:null,borrowerUniversityId:null,borrowerEmail:'student@example.test'})).toEqual({name:'student@example.test',identifier:'รหัสระบบ cfdba773…'})
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

describe('elapsed booking status', () => {
  const now = new Date('2026-10-16T18:30:00+07:00').getTime()

  it('presents an elapsed approved booking as completed', () => {
    expect(effectiveBookingStatus('APPROVED','2026-10-16T18:30:00+07:00',now)).toBe('COMPLETED')
    expect(canCancelBooking('APPROVED','2026-10-16T18:30:00+07:00',now)).toBe(false)
  })

  it('keeps a future approved booking cancellable', () => {
    expect(effectiveBookingStatus('APPROVED','2026-10-16T19:30:00+07:00',now)).toBe('APPROVED')
    expect(canCancelBooking('APPROVED','2026-10-16T19:30:00+07:00',now)).toBe(true)
  })
})
