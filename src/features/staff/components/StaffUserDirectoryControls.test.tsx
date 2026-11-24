import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StaffRegisteredUser, StaffUserDirectoryItem } from '../types/staff-user.types'
import { StaffDirectoryActions, StaffDirectoryStatus } from './StaffUserDirectoryControls'

const active: StaffRegisteredUser = {
  id: 'teacher-1',
  fullName: 'อาจารย์ทดสอบ',
  email: 'teacher@example.test',
  roleCodes: ['TEACHER'],
  roleNames: ['Teacher'],
  accountStatus: 'ACTIVE',
}

describe('staff directory controls', () => {
  it.each([['ACTIVE', 'ระงับบัญชี', 'SUSPENDED'], ['SUSPENDED', 'เปิดใช้งานบัญชี', 'ACTIVE']] as const)(
    'shows the available action for a %s account',
    (accountStatus, label, nextStatus) => {
      const user = { ...active, accountStatus }
      const onStatus = vi.fn()
      const { container } = render(<StaffDirectoryActions user={user} onEdit={vi.fn()} onStatus={onStatus} onRemove={vi.fn()} onEditLecturerName={vi.fn()}/>)
      expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล อาจารย์ทดสอบ' })).toBeInTheDocument()
      const trigger = screen.getByRole('button', { name: 'จัดการบัญชี อาจารย์ทดสอบ' })
      const popover = container.querySelector('[popover="auto"]')
      expect(trigger.getAttribute('popovertarget')).toBe(popover?.id)
      const button = popover?.querySelector('.suspend-user, .activate-user')
      expect(button).toHaveTextContent(label)
      if (button) fireEvent.click(button)
      expect(onStatus).toHaveBeenCalledWith(user, nextStatus)
    },
  )

  it('offers editing and removal for a non-teacher account that has not signed in', () => {
    const user: StaffUserDirectoryItem = { ...active, roleCodes: ['STUDENT'], accountStatus: null, pendingRegistration: true }
    const onEdit = vi.fn()
    const { container } = render(<>
      <StaffDirectoryStatus user={user}/>
      <StaffDirectoryActions user={user} onEdit={onEdit} onStatus={vi.fn()} onRemove={vi.fn()} onEditLecturerName={vi.fn()}/>
    </>)
    expect(screen.getByText('ยังไม่เข้าสู่ระบบ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /แก้ไขข้อมูล/ }))
    expect(onEdit).toHaveBeenCalledWith(user)
    const actions = container.querySelectorAll('[popover="auto"] button')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toHaveTextContent('ลบผู้ใช้')
  })

  it.each<StaffUserDirectoryItem>([active, { ...active, accountStatus: null, pendingRegistration: true }])(
    'opens the lecturer name editor from the popover for a Teacher account',
    user => {
      const onEditLecturerName = vi.fn()
      const { container } = render(<StaffDirectoryActions user={user} onEdit={vi.fn()} onStatus={vi.fn()}
        onRemove={vi.fn()} onEditLecturerName={onEditLecturerName} lecturerNamesReady />)
      const action = screen.getByText('แก้ไขชื่ออาจารย์')
      expect(container.querySelector('[popover="auto"]')).toContainElement(action)
      fireEvent.click(action)
      expect(onEditLecturerName).toHaveBeenCalledWith(user)
    },
  )
})
