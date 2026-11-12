import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaffRoleDialog } from './StaffRoleDialog'

const user={id:'user-1',fullName:'ผู้ใช้ทดสอบ',email:'user@example.test',accountStatus:'ACTIVE' as const,roleCodes:['STUDENT'],roleNames:['Student']}
const roles=[{code:'STUDENT',name:'Student'},{code:'TEACHER',name:'Teacher'}]

describe('StaffRoleDialog',()=>{
  it('submits every selected role',()=>{
    const save=vi.fn()
    render(<StaffRoleDialog user={user} roles={roles} pending={false} onClose={vi.fn()} onSave={save}/>)
    fireEvent.click(screen.getByRole('checkbox',{name:/Teacher/}))
    fireEvent.click(screen.getByRole('button',{name:'บันทึกบทบาท'}))
    expect(save).toHaveBeenCalledWith(expect.arrayContaining(['STUDENT','TEACHER']))
  })
})
