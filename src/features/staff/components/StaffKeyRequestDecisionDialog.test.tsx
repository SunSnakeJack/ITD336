import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaffKeyRequestDecisionDialog } from './StaffKeyRequestDecisionDialog'

describe('StaffKeyRequestDecisionDialog', () => {
  it('requires a reason before rejecting', () => {
    const confirm = vi.fn()
    render(<StaffKeyRequestDecisionDialog requestCode="KR-1" roomCode="S2407" decision="REJECTED" onClose={vi.fn()} onConfirm={confirm}/>)
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }))
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผลที่ไม่อนุมัติ')
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ข้อมูลไม่ครบ' } })
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }))
    expect(confirm).toHaveBeenCalledWith('ข้อมูลไม่ครบ')
  })
})
