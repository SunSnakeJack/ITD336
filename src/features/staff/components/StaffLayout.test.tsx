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

    expect(screen.getByRole('heading', { name: 'ข้อมูลห้อง' })).toBeInTheDocument()
    const drawer = screen.getByTestId('staff-sidebar')
    expect(drawer).not.toHaveClass('is-open')
    fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนู' }))
    expect(drawer).toHaveClass('is-open')
    fireEvent.click(screen.getByRole('button', { name: 'ปิดเมนู' }))
    expect(drawer).not.toHaveClass('is-open')
  })
})
