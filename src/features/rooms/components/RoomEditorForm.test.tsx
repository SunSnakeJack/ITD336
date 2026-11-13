import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomEditorForm } from './RoomEditorForm'

const options={roomTypes:[{id:'type-1',code:'LAB',name:'ห้องปฏิบัติการ'}],equipment:[{id:'equipment-1',code:'MIC',name:'ไมโครโฟน'}]}

describe('RoomEditorForm',()=>{
  it('validates required fields and normalizes checked equipment',()=>{
    const save=vi.fn()
    render(<RoomEditorForm options={options} pending={false} onCancel={vi.fn()} onSave={save}/>)
    fireEvent.click(screen.getByRole('button',{name:'บันทึกข้อมูลห้อง'}))
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณากรอกข้อมูลห้องที่จำเป็นให้ครบถ้วน')
    fireEvent.change(screen.getByLabelText('รหัสห้อง *'),{target:{value:'S2501'}})
    fireEvent.change(screen.getByLabelText('ชื่อสำหรับหน้าจัดการ *'),{target:{value:'ห้องใหม่'}})
    fireEvent.click(screen.getByRole('checkbox',{name:'ไมโครโฟน'}))
    expect(screen.queryByLabelText(/จำนวน/)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('หมายเหตุ')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'บันทึกข้อมูลห้อง'}))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({roomId:null,code:'S2501',name:'ห้องใหม่',equipment:[{equipmentId:'equipment-1',quantity:1,notes:null}]}))
  })
})
