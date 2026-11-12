import { useEffect, useState } from 'react'
import type { StaffRoleOption, StaffUserDirectoryItem } from '../types/staff-user.types'

interface StaffRoleDialogProps {user:StaffUserDirectoryItem;roles:StaffRoleOption[];pending:boolean;error?:string;onClose:()=>void;onSave:(roleCodes:string[])=>void}

export function StaffRoleDialog({user,roles,pending,error,onClose,onSave}:StaffRoleDialogProps){
  const[selected,setSelected]=useState(()=>new Set(user.roleCodes))
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!pending)onClose()};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[onClose,pending])
  const toggle=(code:string)=>setSelected((current)=>{const next=new Set(current);if(next.has(code))next.delete(code);else next.add(code);return next})
  return <div className="staff-role-dialog-backdrop" role="presentation"><section className="staff-role-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-role-dialog-title"><header><div><h2 id="staff-role-dialog-title">แก้ไขบทบาทผู้ใช้</h2><p>{user.fullName} · {user.email}</p></div><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header><div className="staff-role-options">{roles.map((role)=><label key={role.code}><input type="checkbox" checked={selected.has(role.code)} onChange={()=>toggle(role.code)}/><span><strong>{role.name}</strong><small>{role.code}</small></span></label>)}</div>{error&&<p className="staff-role-error" role="alert">{error}</p>}<footer><button type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className="staff-button" type="button" disabled={pending} onClick={()=>onSave([...selected])}>{pending?'กำลังบันทึก…':'บันทึกบทบาท'}</button></footer></section></div>
}
