import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaffAddUserDialog } from './StaffAddUserDialog'

describe('StaffAddUserDialog',()=>{
  it('validates details and submits selected roles',()=>{
    const save=vi.fn()
    render(<StaffAddUserDialog roles={[{code:'TEACHER',name:'Teacher'}]} pending={false} onClose={vi.fn()} onSave={save}/>)
    fireEvent.click(screen.getByRole('button',{name:'ส่งคำเชิญ'}))
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณากรอกชื่อและอีเมลให้ถูกต้อง')
    fireEvent.change(screen.getByLabelText('ชื่อ–นามสกุล'),{target:{value:'อาจารย์ทดสอบ'}})
    fireEvent.change(screen.getByLabelText('อีเมล'),{target:{value:'teacher@example.test'}})
    fireEvent.click(screen.getByRole('checkbox',{name:/Teacher/}))
    fireEvent.click(screen.getByRole('button',{name:'ส่งคำเชิญ'}))
    expect(save).toHaveBeenCalledWith({fullName:'อาจารย์ทดสอบ',email:'teacher@example.test',roleCodes:['TEACHER']})
  })
})
