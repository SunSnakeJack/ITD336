import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog',()=>{
  it('only runs the destructive action after explicit confirmation',()=>{
    const confirm=vi.fn();const close=vi.fn()
    render(<ConfirmDialog title="ยืนยัน" message="ตรวจสอบอีกครั้ง" confirmLabel="ดำเนินการ" onConfirm={confirm} onClose={close}/>)
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'ดำเนินการ'}))
    expect(confirm).toHaveBeenCalledOnce()
  })

  it('closes with Escape while not pending',()=>{
    const close=vi.fn()
    render(<ConfirmDialog title="ยืนยัน" message="ตรวจสอบอีกครั้ง" confirmLabel="ดำเนินการ" onConfirm={vi.fn()} onClose={close}/>)
    fireEvent.keyDown(document,{key:'Escape'})
    expect(close).toHaveBeenCalledOnce()
  })
})
