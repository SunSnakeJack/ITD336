import { useState } from 'react'

interface Props {
  requestCode: string
  roomCode: string
  decision: 'APPROVED' | 'REJECTED'
  pending?: boolean
  error?: string
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function StaffKeyRequestDecisionDialog({ requestCode, roomCode, decision, pending = false, error, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')
  const rejected = decision === 'REJECTED'
  const submit = () => {
    const value = reason.trim()
    if (rejected && !value) { setValidation('กรุณาระบุเหตุผลที่ไม่อนุมัติ'); return }
    onConfirm(value || 'อนุมัติโดยเจ้าหน้าที่')
  }
  return <div className="staff-decision-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="staff-decision-dialog" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <header><div><h2 id="decision-title">{rejected ? 'ไม่อนุมัติคำขอ' : 'อนุมัติคำขอ'}</h2><p>{requestCode} · {roomCode}</p></div><button type="button" aria-label="ปิด" onClick={onClose}>×</button></header>
      {rejected && <label>เหตุผลที่ไม่อนุมัติ <span>*</span><textarea autoFocus value={reason} onChange={event => { setReason(event.target.value); setValidation('') }} placeholder="ระบุเหตุผลเพื่อแจ้งให้ผู้ขอทราบ" /></label>}
      {(validation || error) && <p className="staff-role-error" role="alert">{validation || error}</p>}
      <footer><button type="button" onClick={onClose} disabled={pending}>ยกเลิก</button><button type="button" className={rejected ? 'danger' : 'confirm'} onClick={submit} disabled={pending}>{pending ? 'กำลังบันทึก…' : rejected ? 'ยืนยันไม่อนุมัติ' : 'ยืนยันอนุมัติ'}</button></footer>
    </section>
  </div>
}
