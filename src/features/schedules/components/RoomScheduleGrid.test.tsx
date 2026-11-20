import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { supabase } from '../../../lib/supabase/client'
import { RoomScheduleGrid } from './RoomScheduleGrid'

vi.mock('../../../lib/supabase/client', () => ({ supabase: { rpc: vi.fn() } }))

function renderSchedule(show: boolean, serviceEnded = false) {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: show, error: null } as never)
  render(<QueryClientProvider client={new QueryClient()}>
    <RoomScheduleGrid times={['16:00', '16:30', '18:00']} upcomingTimes={['16:30', '18:00']}
      serviceEnded={serviceEnded} hasSelectableStart={false} onSelect={vi.fn()}
      getSlot={time => time === '16:00' ? { state: 'elapsed', label: 'ผ่านแล้ว', disabled: true }
        : { state: 'occupied', label: 'ผู้จอง', disabled: true }} />
  </QueryClientProvider>)
}

it.each([true, false])('renders elapsed slots only when the saved setting is enabled (%s)', async show => {
  renderSchedule(show)
  expect(await screen.findByRole('button', { name: '16:30 ผู้จอง' })).toBeInTheDocument()
  expect(Boolean(screen.queryByRole('button', { name: '16:00 ผ่านแล้ว' }))).toBe(show)
  expect(screen.getByText('ไม่มีช่วงเวลาว่างที่เหลือวันนี้')).toBeInTheDocument()
})

it('shows the closed-for-today message instead of an empty grid after hours', async () => {
  renderSchedule(false, true)
  expect(await screen.findByText('หมดเวลาให้บริการแล้ววันนี้')).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
