import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { StaffUsageDashboardPage } from './StaffUsageDashboardPage'

vi.mock('../reporting/staff-usage.service', () => ({ getStaffUsageHistory: vi.fn().mockResolvedValue([{
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
  it('places the record table beside the room and user insights on desktop', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><StaffUsageDashboardPage/></QueryClientProvider>)
    await screen.findByText('รายการบันทึก')
    const body = container.querySelector('.usage-dashboard-body')
    expect(body).not.toBeNull()
    expect(body?.firstElementChild).toHaveClass('usage-records-panel')
    const aside = body?.lastElementChild
    expect(aside).toHaveClass('usage-dashboard-insights')
    await waitFor(() => expect(aside?.querySelector('.usage-rooms')).not.toBeNull())
    expect(aside?.querySelector('.usage-ranking')).not.toBeNull()
    expect(container.querySelectorAll('.usage-summary-card')).toHaveLength(3)
    expect(container.querySelector('.usage-records-panel')).toHaveTextContent('แสดง 10 รายการ')
    expect(container.querySelector('.staff-page-header')).toBeNull()
    expect(container.querySelector('.usage-filterbar')).not.toBeNull()
    expect(container.querySelector('.usage-filterbar')).toHaveClass('usage-filterbar-compact')
    expect(container.querySelectorAll('.usage-filter-control')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'ประเภทห้อง ทุกประเภท' }))
    expect(screen.getByRole('listbox', { name: 'ตัวเลือกประเภทห้อง' }).closest('.usage-filter-control')).not.toBeNull()
    expect(container.querySelector('.usage-rooms .usage-card-header')).toHaveTextContent('รวม 1 ครั้ง')
    expect(container.querySelector('.usage-ranking .usage-card-header')).toHaveTextContent('Top 5')
    expect(container.querySelector('.usage-ranking-avatar')).toHaveTextContent('ผู')
    expect(container.querySelector('.usage-records-card')).not.toBeNull()
    expect(container.querySelector('.usage-records-card .usage-table-scroll')).not.toBeNull()
    expect(container.querySelector('.usage-records-footer')).toHaveTextContent('แสดง 1–1 จาก 1 รายการ')
    expect(screen.getByRole('button', { name: 'หน้า 1' })).toHaveAttribute('aria-current', 'page')
  })
})
