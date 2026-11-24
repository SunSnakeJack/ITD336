import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../../../lib/supabase/client'
import { StaffDisplaySettingsPage } from './StaffDisplaySettingsPage'

vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
})

function setup() {
  const fields: Record<string, string | boolean> = {
    key_catalog_display: 'current', lecturer_name_language: 'th', show_elapsed_room_slots: true, public_navigation_mode: 'top',
  }
  let rejectLanguage = false
  vi.mocked(supabase.rpc).mockImplementation((async (name: string, args?: Record<string, string | boolean>) => {
    const field = name.slice(4)
    if (name.startsWith('set_') && args && !(rejectLanguage && field === 'lecturer_name_language')) {
      fields[field] = Object.values(args)[0]
    }
    return { data: fields[field], error: null }
  }) as never)
  const mount = () => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><StaffDisplaySettingsPage /></MemoryRouter>
  </QueryClientProvider>)
  return { fields, mount, rejectLanguage: (value: boolean) => { rejectLanguage = value } }
}

it('keeps all choices in draft until Save All and reloads the saved values', async () => {
  const { mount, fields } = setup()
  const first = mount()
  const button = screen.getByRole('button', { name: 'บันทึกทั้งหมด' })
  expect(button).toBeDisabled()
  fireEvent.click(await screen.findByRole('radio', { name: 'แบบป้ายกุญแจ' }))
  fireEvent.click(screen.getByRole('radio', { name: 'English' }))
  fireEvent.click(screen.getByRole('switch', { name: 'แสดงเวลาที่ผ่านมาแล้ว' }))
  fireEvent.click(screen.getByRole('radio', { name: 'แถบเมนูด้านล่าง' }))
  expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name.startsWith('set_'))).toHaveLength(0)
  expect(screen.getByText(/ภาษาที่บันทึกไว้ ภาษาไทย/)).toBeInTheDocument()
  fireEvent.click(button)
  expect(await screen.findByText('บันทึกการตั้งค่าแล้ว')).toBeInTheDocument()
  expect(fields).toEqual({ key_catalog_display: 'key-tags', lecturer_name_language: 'en', show_elapsed_room_slots: false, public_navigation_mode: 'bottom' })
  first.unmount()
  mount()
  expect(await screen.findByRole('switch', { name: 'แสดงเวลาที่ผ่านมาแล้ว' })).not.toBeChecked()
  expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
})

it('retains failed changes for retry and skips settings that were saved successfully', async () => {
  const { mount, rejectLanguage } = setup()
  rejectLanguage(true)
  mount()
  const english = await screen.findByRole('radio', { name: 'English' })
  fireEvent.click(english)
  fireEvent.click(screen.getByRole('switch', { name: 'แสดงเวลาที่ผ่านมาแล้ว' }))
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('ภาษาชื่ออาจารย์')
  expect(english).toBeChecked()
  expect(screen.getByText(/ภาษาที่บันทึกไว้ ภาษาไทย/)).toBeInTheDocument()
  rejectLanguage(false)
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกทั้งหมด' }))
  await waitFor(() => expect(screen.getByText(/ภาษาที่บันทึกไว้ English/)).toBeInTheDocument())
  expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'set_show_elapsed_room_slots')).toHaveLength(1)
})
