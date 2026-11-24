import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { KeyRoomTagCard } from './KeyRoomTagCard'

const room: ScheduleRoom = {
  id: 'room-1', code: 'S2407', layoutKey: 's2407', name: 'S2407', building: null, floor: null,
  capacity: 40, active: true, bookingEnabled: true, roomTypeName: 'Lab', academicScheduleConfirmed: true,
}

describe('key tag catalog card', () => {
  it('greys out rooms that the viewer cannot request without advertising availability', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="denied" available={['08:00–10:00']} /></MemoryRouter>)
    const message = screen.getByText('บัญชีนี้ไม่มีสิทธิ์เบิกกุญแจห้องนี้')
    expect(message.closest('article')).toHaveClass('key-tag-room-closed')
    expect(message.querySelector('br')?.nextSibling?.textContent).toBe('เบิกกุญแจห้องนี้')
    expect(screen.queryByText('08:00–10:00')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('shows a closed day instead of advertising available times', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="closed" available={['08:00–10:00']} /></MemoryRouter>)
    expect(screen.getByText('งดให้บริการวันนี้').closest('article')).toHaveClass('key-tag-room-closed')
    expect(screen.queryByText('08:00–10:00')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'ดูรายละเอียด S2407' })).not.toBeInTheDocument()
  })
  it('marks a room with no available slots as unavailable', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="ready" available={[]} /></MemoryRouter>)
    expect(screen.getByText('ไม่มีช่วงเวลาว่าง')).toHaveClass('key-tag-unavailable')
  })
  it('shows each available range and opens details from the tag itself', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="ready"
      available={['08:00–10:00', '13:00–16:00']} /></MemoryRouter>)
    expect(screen.getByText('08:00–10:00')).toBeInTheDocument()
    expect(screen.getByText('13:00–16:00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2407' })).toHaveAttribute('href', '/keys/rooms/room-1')
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2407' })).toHaveTextContent('S2407')
    expect(screen.queryByText('ดูรายละเอียด')).not.toBeInTheDocument()
  })

  it('keeps details accessible when the schedule cannot load', () => {
    render(<MemoryRouter><KeyRoomTagCard room={room} schedule="error" available={[]} /></MemoryRouter>)
    expect(screen.getByText('โหลดตารางไม่สำเร็จ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ดูรายละเอียด S2407' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'เบิกกุญแจ S2407' })).toBeNull()
  })
})
