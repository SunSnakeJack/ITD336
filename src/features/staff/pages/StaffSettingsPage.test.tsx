import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { saturdayPolicyKey } from '../../schedules/saturday-policy.queries'
import { meetingAdvanceBookingDaysQuery, staffSettingsKeys } from '../staff-settings.queries'
import { StaffSettingsPage } from './StaffSettingsPage'

it('keeps existing settings and retains draft edits while switching room tabs', () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(staffSettingsKeys.timing, false)
  client.setQueryData(saturdayPolicyKey, null)
  client.setQueryData(meetingAdvanceBookingDaysQuery().queryKey, 3)
  client.setQueryData(['staff', 'settings', 'room-category-restrictions'], {})
  client.setQueryData(['staff', 'role-permission-catalog'], [
    { code: 'ADMIN', role_permissions: [{ permissions: { code: 'ROOM_MANAGE' } }] },
    { code: 'STAFF', role_permissions: [] },
  ])
  render(<QueryClientProvider client={client}><MemoryRouter><StaffSettingsPage /></MemoryRouter></QueryClientProvider>)
  expect(screen.getAllByRole('columnheader')).toHaveLength(7)
  expect(screen.getByRole('checkbox', { name: 'ผู้ดูแลระบบ · จัดการห้อง' })).toBeDisabled()
  expect(screen.getByRole('switch', { name: /เปิดให้จองวันเสาร์ชั่วคราว/ })).not.toBeChecked()
  fireEvent.click(screen.getByRole('switch', { name: /อนุญาตให้เบิกกุญแจในช่วงเวลาที่ผ่านมา/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'เจ้าหน้าที่ · จัดการห้อง' }))
  fireEvent.click(screen.getByRole('button', { name: 'ระยะเวลาขั้นต่ำ 30 นาที' }))
  fireEvent.click(screen.getByRole('option', { name: '1 ชั่วโมง' }))
  fireEvent.click(screen.getByRole('button', { name: 'ห้องประชุม' }))
  const days = screen.getByRole('spinbutton', { name: 'จองล่วงหน้าสูงสุด (วัน)' })
  expect(days).toHaveValue(3)
  fireEvent.change(days, { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'ห้องปฏิบัติการพิเศษ' }))
  expect(screen.getByRole('button', { name: 'ระยะเวลาขั้นต่ำ 30 นาที' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'ห้องปฎิบัติการ' }))
  expect(screen.getByRole('button', { name: 'ระยะเวลาขั้นต่ำ 1 ชั่วโมง' })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: /อนุญาตให้เบิกกุญแจในช่วงเวลาที่ผ่านมา/ })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'เจ้าหน้าที่ · จัดการห้อง' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'ห้องประชุม' }))
  expect(screen.getByRole('spinbutton', { name: 'จองล่วงหน้าสูงสุด (วัน)' })).toHaveValue(5)
  expect(screen.getAllByRole('button', { name: 'บันทึกทั้งหมด' })).toHaveLength(1)
})
