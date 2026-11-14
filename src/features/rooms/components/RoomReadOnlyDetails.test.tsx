import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { RoomReadOnlyDetails } from './RoomReadOnlyDetails'

it('shows the saved room and equipment without edit controls', () => {
  const { container } = render(<RoomReadOnlyDetails room={{
    id: 'room-1', code: 'S2407', name: 'ห้องปฏิบัติการ S2407',
    room_type_id: 'computer', room_type_name: 'Computer Room',
    capacity: 60, active: true, booking_enabled: false, description: null,
    building: null, floor: null, location_description: null, created_at: '', updated_at: '',
    equipment: [{ equipmentId: 'projector', name: 'Projector', quantity: 1, notes: null }],
  }} />)

  expect(screen.getByText('ห้องปฏิบัติการคอมพิวเตอร์')).toBeInTheDocument()
  expect(screen.getByText('เปิดให้จอง: ปิด')).toBeInTheDocument()
  expect(screen.getByText('Projector')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'รูปตัวอย่างห้อง' })).toBeInTheDocument()
  expect(container.querySelector('form, input, select, textarea, button')).toBeNull()
})
