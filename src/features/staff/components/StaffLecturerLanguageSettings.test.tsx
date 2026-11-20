import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase/client'
import { StaffLecturerLanguageSettings } from './StaffLecturerLanguageSettings'

vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

afterEach(() => vi.clearAllMocks())

it.each([true, false])('updates the saved language only when the server confirms it (%s)', async confirmed => {
  vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'th', error: null } as never)
    .mockResolvedValueOnce({ data: confirmed ? 'en' : 'th', error: null } as never)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><StaffLecturerLanguageSettings /></QueryClientProvider>)

  expect(await screen.findByText('ภาษาที่บันทึกไว้ ภาษาไทย')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'English' }))
  expect(screen.getByText('ภาษาที่บันทึกไว้ ภาษาไทย')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกภาษาชื่ออาจารย์' }))

  if (confirmed) {
    expect(await screen.findByText('ภาษาที่บันทึกไว้ English')).toBeInTheDocument()
  } else {
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่สามารถยืนยันการบันทึกภาษาชื่ออาจารย์ได้')
    expect(screen.getByText('ภาษาที่บันทึกไว้ ภาษาไทย')).toBeInTheDocument()
  }
  expect(supabase.rpc).toHaveBeenCalledWith('set_lecturer_name_language', { p_language: 'en' })
})
