import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthIdentity } from '../../auth/auth.types'
import { StaffLayout } from './StaffLayout'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaffRoomsPage } from '../pages/StaffRoomsPage'
import { roomEditorOptionsQuery, roomsQuery } from '../../rooms/room.queries'
import { StaffReportsPage } from '../pages/StaffReportPages'
import { staffUsageQuery } from '../reporting/staff-usage.queries'
import { staffKeyRequestQueryKey } from '../staff-key-request.service'
import { StaffAuditLogsPage } from '../pages/StaffAuditLogsPage'
import { staffAuditQuery } from '../audit/staff-audit'

const identity: AuthIdentity = {
  userId: 'admin-1',
  fullName: 'ผู้ดูแลทดสอบ',
  email: 'admin@example.test',
  role: 'ADMIN',
}

describe('StaffLayout', () => {
  it('restores the selected actor in Logs after visiting Reports', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    client.setQueryData(staffAuditQuery(null, '', 1).queryKey, { rows: [], total: 0 })
    client.setQueryData(staffAuditQuery('ADMIN', '', 1).queryKey, { rows: [], total: 0 })
    client.setQueryData(staffUsageQuery().queryKey, [])
    client.setQueryData(staffKeyRequestQueryKey, [])
    render(<QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/staff/logs']}>
        <Routes>
          <Route path="staff" element={<StaffLayout identity={{ ...identity, userId: 'logs-test-admin' }} onLogout={vi.fn()} />}>
            <Route path="logs" element={<StaffAuditLogsPage />} />
            <Route path="reports" element={<StaffReportsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'แอดมิน' }))
    fireEvent.click(screen.getByRole('link', { name: 'รายงานสถิติ' }))
    fireEvent.click(screen.getByRole('link', { name: 'Logs' }))
    expect(screen.getByRole('button', { name: 'แอดมิน' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('opens the statistics report hub from the ordered system menu', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    client.setQueryData(staffUsageQuery().queryKey, [])
    client.setQueryData(staffKeyRequestQueryKey, [])
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/staff/rooms']}>
      <Routes>
        <Route path="staff" element={<StaffLayout identity={identity} onLogout={vi.fn()} />}>
          <Route path="rooms" element={<p>รายการห้อง</p>} />
          <Route path="reports" element={<StaffReportsPage />} />
        </Route>
      </Routes>
    </MemoryRouter></QueryClientProvider>)
    const menu = screen.getByRole('navigation', { name: 'เมนูระบบเจ้าหน้าที่' })
    expect(Array.from(menu.querySelectorAll('a')).slice(-5).map(link => link.textContent)).toEqual([
      'การตั้งค่าสิทธิ์', 'การตั้งค่าการแสดงผล', 'การตั้งค่าเพิ่มเติม', 'รายงานสถิติ', 'Logs',
    ])
    fireEvent.click(screen.getByRole('link', { name: 'รายงานสถิติ' }))
    expect(screen.getByRole('link', { name: 'รายงานการใช้ห้องปฏิบัติการ' })).toHaveAttribute('href', '/staff/reports/labs')
    expect(screen.getByRole('link', { name: 'รายงานการใช้ห้องประชุม' })).toHaveAttribute('href', '/staff/reports/meetings')
    expect(screen.getByRole('heading', { name: 'จำนวนครั้งการใช้งานรายห้อง' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'สถิติผู้ใช้สูงสุด' })).toBeInTheDocument()
  })
  it('restores room filters and list view after switching staff menus', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    client.setQueryData(roomsQuery().queryKey, [])
    client.setQueryData(roomEditorOptionsQuery().queryKey, { roomTypes: [], equipment: [] })
    render(<QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/staff/rooms']}>
        <Routes>
          <Route path="staff" element={<StaffLayout identity={{ ...identity, userId: 'room-list-admin' }} onLogout={vi.fn()} />}>
            <Route path="rooms" element={<StaffRoomsPage />} />
            <Route path="users" element={<p>รายชื่อผู้ใช้งาน</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>)
    fireEvent.change(screen.getByPlaceholderText('ค้นหารหัสหรือชื่อห้อง'), { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: 'ประเภทห้อง ทุกประเภท' }))
    fireEvent.click(screen.getByRole('option', { name: 'ห้องประชุม' }))
    fireEvent.click(screen.getByRole('button', { name: 'รายการ' }))
    fireEvent.click(screen.getByRole('link', { name: 'จัดการผู้ใช้งาน' }))
    expect(screen.getByText('รายชื่อผู้ใช้งาน')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'จัดการข้อมูลห้อง' }))
    expect(screen.getByPlaceholderText('ค้นหารหัสหรือชื่อห้อง')).toHaveValue('test')
    expect(screen.getByRole('button', { name: 'ประเภทห้อง ห้องประชุม' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'รายการ' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('opens and closes its mobile navigation drawer', () => {
    render(
      <MemoryRouter initialEntries={['/staff/rooms']}>
        <Routes>
          <Route path="staff" element={<StaffLayout identity={identity} onLogout={vi.fn()} />}>
            <Route path="rooms" element={<p>รายการห้อง</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'จัดการข้อมูลห้อง' })).toBeInTheDocument()
    const sidebar = within(screen.getByTestId('staff-sidebar'))
    expect(sidebar.getByText('หลัก')).toBeInTheDocument()
    expect(sidebar.getByText('จัดการ')).toBeInTheDocument()
    expect(sidebar.getByText('ระบบ')).toBeInTheDocument()
    expect(screen.getByTestId('staff-sidebar')).toHaveTextContent('ผู้ดูแลทดสอบ')
    expect(screen.getByTestId('staff-sidebar')).not.toHaveTextContent('admin@example.test')
    expect(screen.getByTestId('staff-topbar')).toHaveTextContent('จัดการข้อมูลห้อง')
    const drawer = screen.getByTestId('staff-sidebar')
    expect(drawer).not.toHaveClass('is-open')
    fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนู' }))
    expect(drawer).toHaveClass('is-open')
    fireEvent.click(screen.getByRole('button', { name: 'ปิดเมนู' }))
    expect(drawer).not.toHaveClass('is-open')
  })

  it('shows the usage dashboard title and opens logout from the sidebar account', () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    render(
      <MemoryRouter initialEntries={['/staff/usage-dashboard']}>
        <Routes>
          <Route path="staff" element={<StaffLayout identity={identity} onLogout={onLogout} />}>
            <Route path="usage-dashboard" element={<p>แดชบอร์ด</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const topbar = screen.getByTestId('staff-topbar')
    expect(topbar).toHaveTextContent('หลัก')
    expect(topbar).toHaveTextContent('แดชบอร์ด')
    expect(screen.getByRole('button', { name: 'พิมพ์ / บันทึก PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ออกจากระบบ' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนูบัญชี' }))
    expect(screen.getByRole('button', { name: 'เปิดเมนูบัญชี' })).not.toHaveTextContent('⌃')
    fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('shows the user management action in the topbar', () => {
    render(
      <MemoryRouter initialEntries={['/staff/users']}>
        <Routes>
          <Route path="staff" element={<StaffLayout identity={identity} onLogout={vi.fn()} />}>
            <Route path="users" element={<p>รายชื่อผู้ใช้</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('staff-topbar')).toHaveTextContent('จัดการ')
    expect(screen.getByRole('link', { name: '+ เพิ่มสมาชิกใหม่' })).toHaveAttribute('href', '/staff/users?dialog=add')
  })
})
