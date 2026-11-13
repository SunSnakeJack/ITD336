import { useEffect, useState } from 'react'
import { SelectField } from '../../../shared/components/SelectField'
import type { StaffRoleOption, StaffUserDirectoryItem } from '../types/staff-user.types'

interface StaffRoleDialogProps {user:StaffUserDirectoryItem;roles:StaffRoleOption[];pending:boolean;error?:string;onClose:()=>void;onSave:(input:{firstName:string;lastName:string;roleCodes:string[];accountStatus:StaffUserDirectoryItem['accountStatus']})=>void}

export function StaffRoleDialog({user,roles,pending,error,onClose,onSave}:StaffRoleDialogProps){
  const[selected,setSelected]=useState(()=>new Set(user.roleCodes))
  const nameParts=user.fullName.trim().split(/\s+/)
  const[firstName,setFirstName]=useState(user.firstName??nameParts[0]??'')
  const[lastName,setLastName]=useState(user.lastName??nameParts.slice(1).join(' '))
  const[accountStatus,setAccountStatus]=useState<StaffUserDirectoryItem['accountStatus']>(user.accountStatus)
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[onClose,pending])
  const toggle=(code:string)=>setSelected((current)=>{const next=new Set(current);if(next.has(code))next.delete(code);else next.add(code);return next})
  const valid=firstName.trim().length>0
  return <div className="staff-role-dialog-backdrop" role="presentation"><section className="staff-role-dialog staff-edit-user-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-role-dialog-title"><header><h2 id="staff-role-dialog-title">แก้ไขข้อมูลผู้ใช้</h2><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header><div className="staff-edit-user-fields"><label>ชื่อ<input value={firstName} onChange={(event)=>setFirstName(event.target.value)}/></label><label>นามสกุล<input value={lastName} onChange={(event)=>setLastName(event.target.value)}/></label><label className="wide">อีเมล<input value={user.email} readOnly/></label></div><p className="staff-dialog-section-label">บทบาท (เลือกได้หลายบทบาท)</p><div className="staff-role-options">{roles.map((role)=><label key={role.code}><input type="checkbox" checked={selected.has(role.code)} onChange={()=>toggle(role.code)}/><span><strong>{role.name}</strong><small>{role.code}</small></span></label>)}</div><div className="staff-role-status"><SelectField label="สถานะบัญชี" value={accountStatus} placeholder="เลือกสถานะบัญชี" options={[{value:'ACTIVE',label:'เปิดใช้งาน'},{value:'SUSPENDED',label:'ระงับการใช้งาน'},{value:'INACTIVE',label:'ปิดใช้งาน'}]} onChange={setAccountStatus}/></div>{error&&<p className="staff-role-error" role="alert">{error}</p>}<footer><button type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className="staff-button" type="button" disabled={pending||!valid} onClick={()=>onSave({firstName:firstName.trim(),lastName:lastName.trim(),roleCodes:[...selected],accountStatus})}>{pending?'กำลังบันทึก…':'บันทึกข้อมูล'}</button></footer></section></div>
}
