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
      const { container } = render(<StaffDirectoryActions user={user} onEdit={vi.fn()} onStatus={onStatus} onRemove={vi.fn()}/>)
      expect(screen.getByRole('button', { name: 'แก้ไขข้อมูล อาจารย์ทดสอบ' })).toBeInTheDocument()
      const trigger = screen.getByRole('button', { name: 'จัดการบัญชี อาจารย์ทดสอบ' })
      const popover = container.querySelector('[popover="auto"]')
      expect(trigger.getAttribute('popovertarget')).toBe(popover?.id)
      const button = popover?.querySelector('button')
      expect(button).toHaveTextContent(label)
      if (button) fireEvent.click(button)
      expect(onStatus).toHaveBeenCalledWith(user, nextStatus)
    },
  )

  it('offers only removal for an account that has not signed in', () => {
    const user: StaffUserDirectoryItem = { ...active, accountStatus: null, pendingRegistration: true }
    const { container } = render(<>
      <StaffDirectoryStatus user={user}/>
      <StaffDirectoryActions user={user} onEdit={vi.fn()} onStatus={vi.fn()} onRemove={vi.fn()}/>
    </>)
    expect(screen.getByText('ยังไม่เข้าสู่ระบบ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /แก้ไขข้อมูล/ })).not.toBeInTheDocument()
    const actions = container.querySelectorAll('[popover="auto"] button')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toHaveTextContent('ลบผู้ใช้')
  })
})
