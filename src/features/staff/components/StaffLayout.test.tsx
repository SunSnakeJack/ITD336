import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthIdentity } from '../../auth/auth.types'
import { StaffLayout } from './StaffLayout'

const identity: AuthIdentity = {
  userId: 'admin-1',
  fullName: 'ผู้ดูแลทดสอบ',
  email: 'admin@example.test',
  role: 'ADMIN',
}

describe('StaffLayout', () => {
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
    expect(screen.getByText('หลัก')).toBeInTheDocument()
    expect(screen.getByText('จัดการ')).toBeInTheDocument()
    expect(screen.getByText('ระบบ')).toBeInTheDocument()
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
    expect(topbar).toHaveTextContent('USAGE DASHBOARD')
    expect(topbar).toHaveTextContent('ภาพรวมการใช้งาน')
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeInTheDocument()
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

    expect(screen.getByTestId('staff-topbar')).toHaveTextContent('USER MANAGEMENT')
    expect(screen.getByRole('link', { name: '+ เพิ่มสมาชิกใหม่' })).toHaveAttribute('href', '/staff/users?dialog=add')
  })
})
