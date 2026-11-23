import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { PublicLayout } from './PublicLayout'
import type { AuthIdentity } from '../../auth/auth.types'
import { AccountProfilePage } from '../pages/AccountProfilePage'

vi.mock('../../notifications/components/NotificationBell', () => ({ NotificationBell: () => <button>การแจ้งเตือน</button> }))
vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

const identity: AuthIdentity = { userId: 'student', fullName: 'Test Student', email: 'student@example.test', role: 'STUDENT' }

function renderMode(mode: string, user: AuthIdentity | null = null) {
  const client = new QueryClient()
  const logout = vi.fn().mockResolvedValue(undefined)
  client.setQueryData(['public-navigation', 'mode'], mode)
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/account/requests']}>
    <Routes><Route element={<PublicLayout identity={user} loading={false} onLogout={logout} />}>
      <Route path="/account/requests" element={<h1>การจองและกุญแจของฉัน</h1>} />
      <Route path="/account/profile" element={<AccountProfilePage identity={identity} />} />
    </Route></Routes>
  </MemoryRouter></QueryClientProvider>)
  return logout
}

it('keeps the current header and drawer in top-only mode', () => {
  renderMode('top', identity)
  expect(screen.queryByRole('navigation', { name: 'เมนูหลัก' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนูผู้ใช้' }))
  expect(screen.getByRole('dialog', { name: 'เมนูผู้ใช้' })).toBeInTheDocument()
})

it('shows exactly three bottom links and removes the header in bottom-only mode', () => {
  renderMode('bottom')
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  const nav = within(screen.getByRole('navigation', { name: 'เมนูหลัก' }))
  expect(nav.getAllByRole('link')).toHaveLength(3)
  const bookings = nav.getByRole('link', { name: 'การจอง' })
  expect(bookings).toHaveAttribute('aria-current', 'page')
  expect(bookings).toHaveAttribute('href', '/account/requests')
})

it('shows both navigation bars without opening the drawer in combined mode', () => {
  const logout = renderMode('both', identity)
  const nav = within(screen.getByRole('navigation', { name: 'เมนูหลัก' }))
  expect(nav.getAllByRole('link')).toHaveLength(4)
  expect(nav.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])).toEqual([
    ['เบิกกุญแจ', '/keys'], ['จองห้อง', '/meeting-room'], ['ประวัติ', '/account/requests'], ['โปรไฟล์', '/account/profile'],
  ])
  expect(nav.getByRole('link', { name: 'ประวัติ' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(screen.getByRole('button', { name: 'เปิดเมนูผู้ใช้' }))
  expect(screen.queryByRole('dialog', { name: 'เมนูผู้ใช้' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))
  expect(logout).toHaveBeenCalledOnce()
})

it('keeps notifications and sign-out accessible from the profile in bottom-only mode', () => {
  const logout = renderMode('bottom', identity)
  fireEvent.click(screen.getByRole('link', { name: 'โปรไฟล์' }))
  expect(screen.getByRole('button', { name: 'การแจ้งเตือน' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }))
  expect(logout).toHaveBeenCalledOnce()
})
