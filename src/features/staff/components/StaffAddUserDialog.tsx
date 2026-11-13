import { useState } from 'react'
import type { StaffRoleOption } from '../types/staff-user.types'

interface Props {
  roles: StaffRoleOption[]; pending: boolean; error?: string; onClose: () => void
  onSave: (input: { fullName: string; email: string; roleCodes: string[] }) => void
}

export function StaffAddUserDialog({ roles, pending, error, onClose, onSave }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [validation, setValidation] = useState('')
  const toggle = (code: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(code)) next.delete(code); else next.add(code)
    return next
  })
  const submit = () => {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    if (!fullName || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setValidation('กรุณากรอกชื่อและอีเมลให้ถูกต้อง'); return
    }
    onSave({ fullName: fullName.trim(), email: email.trim(), roleCodes: [...selected] })
  }
  return <div className="staff-role-dialog-backdrop" role="presentation">
    <section className="staff-role-dialog staff-add-user-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-add-user-title">
      <header><div><h2 id="staff-add-user-title">เพิ่มสมาชิกใหม่</h2><p>ระบบจะส่งคำเชิญไปยังอีเมลที่ระบุ</p></div><button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header>
      <div className="staff-add-user-fields"><label>ชื่อ<input autoFocus value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>นามสกุล<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label className="wide">อีเมล<input type="email" value={email} placeholder="example@northbkk.ac.th" onChange={(event) => setEmail(event.target.value)} /></label></div>
      <p className="staff-dialog-section-label">บทบาท (เลือกได้หลายบทบาท)</p>
      <div className="staff-role-options">{roles.map((role) => <label key={role.code}><input type="checkbox" checked={selected.has(role.code)} onChange={() => toggle(role.code)} /><span><strong>{role.name}</strong><small>{role.code}</small></span></label>)}</div>
      {(validation || error) && <p className="staff-role-error" role="alert">{validation || error}</p>}
      <footer><button type="button" disabled={pending} onClick={onClose}>ยกเลิก</button><button className="staff-button" type="button" disabled={pending} onClick={submit}>{pending ? 'กำลังส่งคำเชิญ…' : 'ส่งคำเชิญ'}</button></footer>
    </section>
  </div>
}
