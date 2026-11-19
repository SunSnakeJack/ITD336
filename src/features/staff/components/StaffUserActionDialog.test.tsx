import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StaffRegisteredUser } from '../types/staff-user.types'
import { StaffUserActionDialog } from './StaffUserActionDialog'

const user: StaffRegisteredUser = {
  id: 'user-1', fullName: 'Somchai Example', email: 'somchai@example.test',
  accountStatus: 'ACTIVE', roleCodes: [], roleNames: [],
}

describe('StaffUserActionDialog', () => {
  it('identifies the account and confirms suspension explicitly', () => {
    const onConfirm = vi.fn()
    render(<StaffUserActionDialog user={user} action="SUSPENDED" pending={false} onConfirm={onConfirm} onClose={vi.fn()}/>)
    const dialog = within(screen.getByRole('alertdialog', { name: 'ระงับบัญชีผู้ใช้' }))
    expect(dialog.getByText(user.fullName)).toBeInTheDocument()
    expect(dialog.getByText(user.email)).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'ยืนยันการระงับ' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('explains what is removed for a preassigned account and supports cancelling', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(<StaffUserActionDialog user={{ ...user, pendingRegistration: true, accountStatus: null }}
      action="REMOVE" pending={false} onConfirm={onConfirm} onClose={onClose}/>)
    expect(screen.getByText(/นำออกจากรายชื่อที่กำหนดสิทธิ์ล่วงหน้า/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('retains history in the explanation and displays an operation error', () => {
    render(<StaffUserActionDialog user={user} action="REMOVE" pending={false}
      error="ไม่สามารถลบผู้ใช้ได้" onConfirm={vi.fn()} onClose={vi.fn()}/>)
    expect(screen.getByText(/ระบบจะเก็บประวัติการใช้งานไว้/)).toBeInTheDocument()
    const dialog = screen.getByRole('alertdialog')
    const warning = within(dialog).getByText('กรุณาตรวจสอบบัญชีก่อนยืนยันการลบ')
    expect(dialog).not.toHaveClass('staff-user-removal-warning')
    expect(warning).toHaveClass('staff-user-removal-warning')
    expect(screen.getByRole('alert')).toHaveTextContent('ไม่สามารถลบผู้ใช้ได้')
  })
})
