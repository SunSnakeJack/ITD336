import{useState}from'react'
import{useMutation,useQueryClient}from'@tanstack/react-query'
import{setKeyRequestTimingSetting}from'../staff-settings.service'
import{staffSettingsKeys}from'../staff-settings.queries'

export function StaffPermissionSettings({initialValue}:{initialValue:boolean}){
 const[value,setValue]=useState(initialValue),client=useQueryClient()
 const save=useMutation({mutationFn:setKeyRequestTimingSetting,onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:staffSettingsKeys.timing}),client.invalidateQueries({queryKey:['key-loans','timing-policy']})])}})
 return <article className="staff-card staff-permission-setting"><div><h3>อนุญาตให้เบิกกุญแจในช่วงเวลาที่ผ่านมา</h3><p>เมื่อเปิด ผู้ใช้สามารถเลือกช่วงเวลาที่ผ่านไปแล้วภายในวันปัจจุบันได้ โดยระบบยังตรวจเวลาซ้อน เวลาบริการ และสถานะห้องตามเดิม</p></div><label className="staff-setting-switch"><input type="checkbox" checked={value} onChange={event=>setValue(event.target.checked)}/><span aria-hidden="true"/><b>{value?'เปิดใช้งาน':'ปิดใช้งาน'}</b></label><button className="staff-button" disabled={save.isPending||value===initialValue} onClick={()=>save.mutate(value)}>{save.isPending?'กำลังบันทึก…':'บันทึกการตั้งค่า'}</button>{save.isSuccess&&<p className="staff-setting-success" role="status">บันทึกการตั้งค่าแล้ว</p>}{save.error&&<p className="staff-role-error" role="alert">ไม่สามารถบันทึกได้ กรุณาตรวจสอบสิทธิ์แล้วลองใหม่</p>}</article>
}
