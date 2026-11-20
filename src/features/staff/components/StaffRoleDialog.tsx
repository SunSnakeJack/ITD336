import { useEffect, useState } from 'react'
import { StaffRoleChips } from './StaffRoleChips'
import { SelectField } from '../../../shared/components/SelectField'
import type { StaffRoleOption, StaffRegisteredUser } from '../types/staff-user.types'

interface StaffRoleDialogProps {user:StaffRegisteredUser;roles:StaffRoleOption[];pending:boolean;error?:string;onClose:()=>void;onSave:(input:{firstName:string;lastName:string;roleCodes:string[];accountStatus:StaffRegisteredUser['accountStatus']})=>void}

export function StaffRoleDialog({user,roles,pending,error,onClose,onSave}:StaffRoleDialogProps){
  const[selected,setSelected]=useState(()=>new Set(user.roleCodes))
  const nameParts=user.fullName.trim().split(/\s+/)
  const[firstName,setFirstName]=useState(user.firstName??nameParts[0]??'')
  const[lastName,setLastName]=useState(user.lastName??nameParts.slice(1).join(' '))
  const[accountStatus,setAccountStatus]=useState<StaffRegisteredUser['accountStatus']>(user.accountStatus)
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[onClose,pending])
  const toggle=(code:string)=>setSelected((current)=>{const next=new Set(current);if(next.has(code))next.delete(code);else next.add(code);return next})
  const valid=firstName.trim().length>0
  return <div className="staff-role-dialog-backdrop" role="presentation"><section className="staff-role-dialog staff-edit-user-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-role-dialog-title"><header><h2 id="staff-role-dialog-title">แก้ไขข้อมูลผู้ใช้</h2><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header><div className="staff-edit-user-fields"><label>ชื่อ<input value={firstName} onChange={(event)=>setFirstName(event.target.value)}/></label><label>นามสกุล<input value={lastName} onChange={(event)=>setLastName(event.target.value)}/></label><label className="wide">อีเมล<input value={user.email} readOnly/></label></div><p className="staff-dialog-section-label">บทบาท (เลือกได้หลายบทบาท)</p><StaffRoleChips roles={roles} selected={selected} disabled={pending} onToggle={toggle}/><div className="staff-role-status"><SelectField label="สถานะบัญชี" value={accountStatus} placeholder="เลือกสถานะบัญชี" options={[{value:'ACTIVE',label:'เปิดใช้งาน'},{value:'INACTIVE',label:'ปิดใช้งาน'},{value:'SUSPENDED',label:'ระงับการใช้งาน'}]} onChange={setAccountStatus}/></div>{error&&<p className="staff-role-error" role="alert">{error}</p>}<footer><button type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className="staff-button" type="button" disabled={pending||!valid} onClick={()=>onSave({firstName:firstName.trim(),lastName:lastName.trim(),roleCodes:[...selected].filter(code => code !== 'PRIORITY_USER' || (!selected.has('DEAN') && !selected.has('DEPARTMENT_HEAD'))),accountStatus})}>{pending?'กำลังบันทึก…':'บันทึกข้อมูล'}</button></footer></section></div>
}
