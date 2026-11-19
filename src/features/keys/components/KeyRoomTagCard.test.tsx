import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { KeyRoomTagCard } from './KeyRoomTagCard'

const room: ScheduleRoom = {
  id: 'room-1', code: 'S2407', layoutKey: 's2407', name: 'S2407', building: null, floor: null,
  capacity: 40, active: true, bookingEnabled: true, roomTypeName: 'Lab', academicScheduleConfirmed: true,
}

describe('key tag catalog card', () => {
  it('shows each available range and links to the room detail and request', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="ready"
      available={['08:00–10:00', '13:00–16:00']} requestPath="/keys/rooms/room-1/request" /></MemoryRouter>)
    expect(screen.getByText('08:00–10:00')).toBeInTheDocument()
    expect(screen.getByText('13:00–16:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2407' })).toHaveAttribute('href', '/keys/rooms/room-1')
    expect(screen.getByRole('link', { name: 'เบิกกุญแจ S2407' })).toHaveAttribute('href', '/keys/rooms/room-1/request')
  })

  it('uses the sign-in action for a room that requires it', () => {
    const onSignIn = vi.fn()
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="ready" onSignIn={onSignIn}
      available={['08:00–10:00']} requestPath="/keys/rooms/room-1/request" /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'เบิกกุญแจ S2407' }))
    expect(onSignIn).toHaveBeenCalledOnce()
  })

  it('keeps details accessible when the schedule cannot load', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="error" available={[]} /></MemoryRouter>)
    expect(screen.getByText('โหลดตารางไม่สำเร็จ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2407' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'เบิกกุญแจ S2407' })).toBeNull()
  })
})
