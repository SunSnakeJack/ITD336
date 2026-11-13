import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaffRoleDialog } from './StaffRoleDialog'

const user={id:'user-1',firstName:'ผู้ใช้',lastName:'ทดสอบ',fullName:'ผู้ใช้ ทดสอบ',email:'user@example.test',accountStatus:'ACTIVE' as const,roleCodes:['STUDENT'],roleNames:['Student']}
const roles=[{code:'STUDENT',name:'Student'},{code:'TEACHER',name:'Teacher'}]

describe('StaffRoleDialog',()=>{
  it('submits every selected role and the selected account status',()=>{
    const save=vi.fn()
    render(<StaffRoleDialog user={user} roles={roles} pending={false} onClose={vi.fn()} onSave={save}/>)
    fireEvent.change(screen.getByLabelText('ชื่อ'), { target: { value: 'ชื่อใหม่' } })
    fireEvent.click(screen.getByRole('checkbox',{name:/Teacher/}))
    fireEvent.click(screen.getByRole('button', { name: 'สถานะบัญชี เปิดใช้งาน' }))
    fireEvent.click(screen.getByRole('option', { name: 'ระงับการใช้งาน' }))
    fireEvent.click(screen.getByRole('button',{name:'บันทึกข้อมูล'}))
    expect(save).toHaveBeenCalledWith({
      firstName: 'ชื่อใหม่',
      lastName: 'ทดสอบ',
      roleCodes: expect.arrayContaining(['STUDENT','TEACHER']),
      accountStatus: 'SUSPENDED',
    })
  })
})
