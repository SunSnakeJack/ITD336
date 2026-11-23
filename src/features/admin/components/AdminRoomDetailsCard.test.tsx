import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { updateRoomDetails } from '../../schedules/schedule.service'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { AdminRoomDetailsCard } from './AdminRoomDetailsCard'

vi.mock('../../schedules/schedule.service', () => ({ updateRoomDetails: vi.fn().mockResolvedValue(true) }))

it('keeps mixed case in the room code field and sends it to the save service', async () => {
  const room: ScheduleRoom = {
    id: 'room-1', code: 'E-LEARNING', layoutKey: 'ELEARNING', name: 'E-Learning',
    capacity: 20, active: true, bookingEnabled: true, building: null, floor: null, roomTypeName: 'Lab', academicScheduleConfirmed: true,
  }
  render(<QueryClientProvider client={new QueryClient()}><AdminRoomDetailsCard room={room} /></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'แก้ไขข้อมูลห้อง' }))
  const code = screen.getByLabelText('รหัสห้อง')
  fireEvent.change(code, { target: { value: 'E-Learning' } })
  expect(code).toHaveValue('E-Learning')
  fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }))
  await waitFor(() => expect(updateRoomDetails).toHaveBeenCalledWith(expect.objectContaining({ code: 'E-Learning' }), expect.anything()))
})
