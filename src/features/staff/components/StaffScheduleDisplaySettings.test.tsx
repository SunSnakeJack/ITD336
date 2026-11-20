import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase/client'
import { StaffScheduleDisplaySettings } from './StaffScheduleDisplaySettings'

vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

it('saves the toggle and reads the saved value in a new session', async () => {
  let show = true
  vi.mocked(supabase.rpc).mockImplementation((async (name: string, args?: { p_show: boolean }) => {
    if (name === 'set_show_elapsed_room_slots' && args) show = args.p_show
    return { data: show, error: null }
  }) as never)
  const mount = () => render(<QueryClientProvider client={new QueryClient()}>
    <StaffScheduleDisplaySettings />
  </QueryClientProvider>)

  const first = mount()
  const toggle = await screen.findByRole('switch', { name: 'แสดงเวลาที่ผ่านมาแล้ว' })
  expect(toggle).toBeChecked()
  fireEvent.click(toggle)
  expect(await screen.findByText('บันทึกการแสดงผลตารางแล้ว')).toBeInTheDocument()
  expect(supabase.rpc).toHaveBeenCalledWith('set_show_elapsed_room_slots', { p_show: false })
  first.unmount()

  mount()
  expect(await screen.findByRole('switch', { name: 'แสดงเวลาที่ผ่านมาแล้ว' })).not.toBeChecked()
})
