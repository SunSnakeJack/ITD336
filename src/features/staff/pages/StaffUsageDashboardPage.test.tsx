import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { StaffUsageDashboardPage } from './StaffUsageDashboardPage'
import { confirmOverdueRoomKeyReturns, getStaffUsageHistory } from '../reporting/staff-usage.service'
import { approveBooking, rejectBooking } from '../../bookings/booking.service'

vi.mock('../../bookings/booking.service', () => ({
  approveBooking: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
  rejectBooking: vi.fn().mockResolvedValue({ status: 'REJECTED' }),
}))

vi.mock('../reporting/staff-usage.service', () => ({ confirmOverdueRoomKeyReturns: vi.fn(), getStaffUsageHistory: vi.fn().mockResolvedValue([{
  transactionId: 'request-1', source: 'KEY_REQUEST', roomId: 'room-1', roomCode: 'S2407', roomName: 'ห้อง S2407',
  roomCategory: 'GENERAL_LAB', purpose: 'สอน', userName: 'ผู้ใช้', startsAt: '2026-11-13T01:00:00Z',
  endsAt: '2026-11-13T02:00:00Z', returnedAt: null, status: 'PENDING_APPROVAL',
}]) }))
vi.mock('../staff-key-request.service', () => ({
  staffKeyRequestQueryKey: ['staff', 'key-request-queue'],
  getStaffKeyRequests: vi.fn().mockResolvedValue([]),
  decideStaffKeyRequest: vi.fn(),
}))

describe('StaffUsageDashboardPage layout', () => {
  it.each(['อนุมัติ', 'ไม่อนุมัติ'])('supports %s for pending meeting bookings', async choice => {
    vi.mocked(getStaffUsageHistory).mockResolvedValueOnce([{
      transactionId: 'booking:meeting-1', source: 'BOOKING', roomId: 'room-1', roomCode: 'MEETING-ROOM',
      roomName: 'ห้องประชุม', roomCategory: 'MEETING', purpose: 'ประชุม', userName: 'ผู้จอง',
      startsAt: '2026-11-17T01:30:00Z', endsAt: '2026-11-17T02:00:00Z', returnedAt: null, status: 'PENDING',
    }])
    const client = new QueryClient()
    render(<QueryClientProvider client={client}><MemoryRouter><StaffUsageDashboardPage /></MemoryRouter></QueryClientProvider>)
    const button = await screen.findByRole('button', { name: choice })
    expect(button.closest('td')?.cellIndex).toBe(8)
    fireEvent.click(button)
    const dialog = within(screen.getByRole('dialog'))
    if (choice === 'ไม่อนุมัติ') {
      fireEvent.click(dialog.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }))
      expect(dialog.getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผล')
      fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'งดใช้ห้อง' } })
    }
    fireEvent.click(dialog.getByRole('button', { name: `ยืนยัน${choice}` }))
    await waitFor(() => expect(choice === 'อนุมัติ' ? approveBooking : rejectBooking)
      .toHaveBeenCalledWith('meeting-1', choice === 'อนุมัติ' ? 'อนุมัติโดยเจ้าหน้าที่' : 'งดใช้ห้อง'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('exports a report with the current filters and all matching columns', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter><StaffUsageDashboardPage /></MemoryRouter></QueryClientProvider>)
    await screen.findByText('รายการบันทึก')
    fireEvent.change(screen.getByLabelText('ตั้งแต่วันที่'), { target: { value: '2026-11-13' } })
    const exportForm = container.querySelector('#usage-report-export')
    if (!exportForm) throw new Error('Export form missing')
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    fireEvent.submit(exportForm)
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    const output = document.querySelector<HTMLElement>('.usage-report-output')
    if (!output) throw new Error('Print output missing')
    expect(output).toHaveAttribute('data-ready', 'true')
    expect(output).toHaveTextContent('ตั้งแต่ 13 พฤศจิกายน 2569')
    expect(output).toHaveTextContent('หน้าที่ 1/1')
    expect(within(output).getAllByRole('columnheader', { hidden: true })).toHaveLength(9)
    expect(output).toHaveTextContent('S2407')
    expect(output).not.toHaveTextContent('ห้อง S2407')
    expect(output).toHaveTextContent('รออนุมัติ')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent(window, new Event('afterprint'))
    expect(document.querySelector('.usage-report-output')).toBeNull()
    print.mockRestore()
  })

  it('places the room and user insights above the full-width record table', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter><StaffUsageDashboardPage /></MemoryRouter></QueryClientProvider>)
    await screen.findByText('รายการบันทึก')
    const body = container.querySelector('.usage-dashboard-body')
    expect(body).not.toBeNull()
    expect(body?.lastElementChild).toHaveClass('usage-records-panel')
    const aside = body?.firstElementChild
    expect(aside).toHaveClass('usage-dashboard-insights')
    await waitFor(() => expect(aside?.querySelector('.usage-rooms')).not.toBeNull())
    expect(aside?.querySelector('.usage-ranking')).not.toBeNull()
    expect(container.querySelectorAll('.usage-summary-card')).toHaveLength(3)
    expect(container.querySelector('.usage-records-panel')).toHaveTextContent('แสดง 10 รายการ')
    expect(container.querySelector('.staff-page-header')).toBeNull()
    const filters = body?.children[1]
    expect(filters).toHaveClass('usage-filterbar-compact')
    expect(filters).not.toHaveClass('staff-toolbar')
    expect(filters?.nextElementSibling).toHaveClass('usage-records-panel')
    expect(container.querySelectorAll('.usage-filter-control')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'ประเภทห้อง ทุกประเภท' }))
    expect(screen.getByRole('listbox', { name: 'ตัวเลือกประเภทห้อง' }).closest('.usage-filter-control')).not.toBeNull()
    expect(container.querySelector('.usage-rooms .usage-card-header')).toHaveTextContent('รวม 1 ครั้ง')
    expect(container.querySelector('.usage-ranking .usage-card-header')).toHaveTextContent('Top 5')
    fireEvent.change(screen.getByLabelText('ตั้งแต่วันที่'), { target: { value: '2026-11-13' } })
    expect(screen.getByRole('link', { name: 'จำนวนครั้งการใช้งานรายห้อง' })).toHaveAttribute('href', '/staff/reports?view=rooms&from=2026-11-13')
    expect(screen.getByRole('link', { name: 'สถิติผู้ใช้สูงสุด' })).toHaveAttribute('href', '/staff/reports?view=users&from=2026-11-13')
    expect(container.querySelector('.usage-ranking-avatar')).toHaveTextContent('ผู')
    expect(container.querySelector('.usage-records-card')).not.toBeNull()
    expect(container.querySelector('.usage-records-card .usage-table-scroll')).not.toBeNull()
    expect(screen.getByRole('cell', { name: 'S2407' })).toHaveTextContent(/^S2407$/)
    expect(screen.getAllByRole('columnheader')).toHaveLength(9)
    expect(screen.queryByRole('columnheader', { name: 'ประเภท' })).not.toBeInTheDocument()
    expect(container.querySelector('.usage-purpose')).toHaveAttribute('tabindex', '0')
    expect(container.querySelector('.usage-records-footer')).toHaveTextContent('แสดง 1–1 จาก 1 รายการ')
    expect(screen.getByRole('button', { name: 'หน้า 1' })).toHaveAttribute('aria-current', 'page')
  })

  it('combines room and status filters and confirms overdue returns beyond the date filter', async () => {
    const rows = (await getStaffUsageHistory()).map(row => ({
      ...row, status: 'APPROVED', startsAt: '2020-11-13T01:00:00Z', endsAt: '2020-11-13T02:00:00Z',
    }))
    const [row] = rows
    vi.mocked(getStaffUsageHistory).mockResolvedValueOnce([
      row,
      { ...row, transactionId: 'older', startsAt: '2020-11-12T01:00:00Z', endsAt: '2020-11-12T02:00:00Z' },
      { ...row, transactionId: 'other-room', roomId: 'room-2', roomCode: 'S2408' },
      { ...row, transactionId: 'returned', status: 'RETURNED_VERIFIED', returnedAt: '2020-11-13T03:00:00Z' },
    ])
    vi.mocked(confirmOverdueRoomKeyReturns).mockResolvedValue(2)
    const client = new QueryClient()
    render(<QueryClientProvider client={client}><MemoryRouter><StaffUsageDashboardPage /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'ห้อง ทุกห้อง' }))
    fireEvent.click(screen.getByRole('option', { name: /^S2407$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'สถานะห้อง ทุกสถานะ' }))
    fireEvent.click(screen.getByRole('option', { name: 'เกินกำหนด' }))
    fireEvent.change(screen.getByLabelText('ตั้งแต่วันที่'), { target: { value: '2020-11-13' } })
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันรับกุญแจ' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/S2407/)).toBeInTheDocument()
    expect(await dialog.findByText(/2 รายการ/)).toBeInTheDocument()
    expect(confirmOverdueRoomKeyReturns).toHaveBeenCalledExactlyOnceWith({ roomId: 'room-1', count: null })
    fireEvent.click(dialog.getByRole('button', { name: 'ยืนยันว่าได้รับกุญแจ' }))
    await waitFor(() => expect(confirmOverdueRoomKeyReturns).toHaveBeenCalledWith({ roomId: 'room-1', count: 2 }, expect.anything()))
    expect(await screen.findByText('บันทึกคืนกุญแจแล้ว 2 รายการ')).toBeInTheDocument()
  })
})
