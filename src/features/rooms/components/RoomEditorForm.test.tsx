import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoomEditorForm } from './RoomEditorForm'

const options={roomTypes:[{id:'type-1',code:'LAB',name:'ห้องปฏิบัติการ'}],equipment:[{id:'equipment-1',code:'MIC',name:'ไมโครโฟน'}]}

describe('RoomEditorForm',()=>{
  it('validates and saves a Thai room name from a button outside the form', () => {
    const onSave = vi.fn()
    render(<>
      <button type="submit" form="test-room-editor">บันทึกด้านบน</button>
      <RoomEditorForm formId="test-room-editor" options={options} pending={false} onCancel={vi.fn()} onSave={onSave} />
    </>)
    const submit = screen.getByRole('button', { name: 'บันทึกด้านบน' })
    fireEvent.click(submit)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('รหัสห้อง *'), { target: { value: 'MEETING-ROOM' } })
    fireEvent.change(screen.getByLabelText('ชื่อสำหรับหน้าจัดการ *'), { target: { value: 'ห้องประชุมคณะ' } })
    fireEvent.click(submit)
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ code: 'MEETING-ROOM', name: 'ห้องประชุมคณะ' }))
  })
  it('excludes COLD from new rooms and allows selecting a Thai format by group', () => {
    render(<RoomEditorForm options={{ ...options, roomTypes: [
      { id: 'cold', code: 'COLD', name: 'Cold Room' },
      { id: 'computer', code: 'COMPUTER', name: 'Computer Room' },
      { id: 'studio', code: 'STUDIO', name: 'Studio' },
    ] }} pending={false} onCancel={vi.fn()} onSave={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /รูปแบบห้อง.*ห้องปฏิบัติการคอมพิวเตอร์/ }))
    expect(screen.queryByRole('option', { name: 'ห้องควบคุมอุณหภูมิ' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /กลุ่มห้อง.*ห้องทั่วไป/ }))
    fireEvent.click(screen.getByRole('option', { name: 'ห้องพิเศษ' }))
    fireEvent.click(screen.getByRole('button', { name: /รูปแบบห้อง.*เลือกรูปแบบห้อง/ }))
    expect(screen.getByRole('option', { name: 'ห้องสตูดิโอ' })).toBeInTheDocument()
  })
  it('validates required fields and normalizes checked equipment',()=>{
    const save=vi.fn()
    render(<RoomEditorForm options={options} pending={false} onCancel={vi.fn()} onSave={save}/>)
    fireEvent.click(screen.getByRole('button',{name:'บันทึกข้อมูลห้อง'}))
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณากรอกข้อมูลห้องที่จำเป็นให้ครบถ้วน')
    fireEvent.change(screen.getByLabelText('รหัสห้อง *'),{target:{value:'S2501'}})
    fireEvent.change(screen.getByLabelText('ชื่อสำหรับหน้าจัดการ *'),{target:{value:'ห้องใหม่'}})
    const equipment = screen.getByRole('group', { name: 'อุปกรณ์เพิ่มเติม' })
    expect(equipment.closest('section')).toContainElement(screen.getByLabelText('คำอธิบายใต้ชื่อห้อง'))
    const microphone = within(equipment).getByRole('checkbox', { name: 'ไมโครโฟน' })
    fireEvent.click(microphone)
    expect(microphone).toBeChecked()
    fireEvent.click(microphone)
    expect(microphone).not.toBeChecked()
    fireEvent.click(microphone)
    expect(screen.queryByLabelText(/จำนวน/)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('หมายเหตุ')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'บันทึกข้อมูลห้อง'}))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({roomId:null,code:'S2501',name:'ห้องใหม่',equipment:[{equipmentId:'equipment-1',quantity:1,notes:null}]}))
  })
})
