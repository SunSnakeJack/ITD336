import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { meetingBookingPolicyKey } from '../../meeting-rooms/meeting-booking-policy'
import { setMeetingAdvanceBookingDays } from '../staff-settings.service'
import { StaffMeetingAdvanceBookingSetting } from './StaffMeetingAdvanceBookingSetting'

vi.mock('../staff-settings.service', () => ({
  getMeetingAdvanceBookingDays: vi.fn().mockResolvedValue(3),
  setMeetingAdvanceBookingDays: vi.fn().mockResolvedValue(30),
}))

it('loads the saved limit and refreshes the booking policy after saving', async () => {
  const client = new QueryClient()
  client.setQueryData(meetingBookingPolicyKey, { allowed_dates: [] })
  render(<QueryClientProvider client={client}><StaffMeetingAdvanceBookingSetting /></QueryClientProvider>)

  const select = await screen.findByRole('button', { name: 'จำนวนวันจองล่วงหน้า 3 วัน' })
  const save = screen.getByRole('button', { name: 'บันทึกระยะเวลาจอง' })
  expect(save).toBeDisabled()
  fireEvent.click(select)
  expect(screen.getByRole('option', { name: '1 วัน' })).toBeInTheDocument()
  expect(screen.getAllByRole('option')).toHaveLength(30)

  expect(screen.getByRole('option', { name: '3 วัน' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('option', { name: '30 วัน' }))
  fireEvent.click(save)

  expect(await screen.findByRole('status')).toHaveTextContent('บันทึกระยะเวลาจองแล้ว')
  expect(setMeetingAdvanceBookingDays).toHaveBeenCalledExactlyOnceWith(30, expect.anything())
  expect(select).toHaveAccessibleName('จำนวนวันจองล่วงหน้า 30 วัน')
  expect(save).toBeDisabled()
  expect(client.getQueryState(meetingBookingPolicyKey)?.isInvalidated).toBe(true)
})
