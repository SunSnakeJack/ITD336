import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { StaffRoomGridCard } from './StaffRoomGridCard'

it('shows the room code, status, capacity and equipment in the compact card', () => {
  render(<MemoryRouter><StaffRoomGridCard room={{
    id: 'room-1', code: 'S2407', name: 'ห้องปฏิบัติการ S2407', room_type_id: 'computer',
    capacity: 60, active: true, booking_enabled: false, description: null,
    building: null, floor: null, location_description: null, created_at: '', updated_at: '',
  }} equipmentSummary="Projector, Smart TV"/></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'S2407' })).toBeInTheDocument()
  expect(screen.queryByText('ห้องปฏิบัติการ S2407')).not.toBeInTheDocument()
  expect(screen.getByText('เปิดใช้งาน')).toBeInTheDocument()
  expect(screen.getByText('60 ที่นั่ง')).toBeInTheDocument()
  expect(screen.getByText('Projector, Smart TV')).toHaveAttribute('title', 'Projector, Smart TV')
  expect(screen.getByRole('link', { name: 'รายละเอียด' })).toHaveAttribute('href', '/staff/rooms/room-1')
  expect(screen.getByRole('link', { name: 'แก้ไข' })).toHaveAttribute('href', '/staff/rooms/room-1/edit')
})
