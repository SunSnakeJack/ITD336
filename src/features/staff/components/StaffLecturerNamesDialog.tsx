import { useEffect, useId, useState } from 'react'
import type { LecturerNames } from '../staff-lecturer-names'

export function StaffLecturerNamesDialog({ email, originalName, names, pending, error, onClose, onSave }: {
  email: string
  originalName: string
  names?: LecturerNames
  pending: boolean
  error?: string
  onClose: () => void
  onSave: (names: LecturerNames) => void
}) {
  const titleId = useId()
  const [thai, setThai] = useState(names?.name_th ?? '')
  const [english, setEnglish] = useState(names?.name_en ?? '')
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [onClose, pending])

  return <div className="staff-role-dialog-backdrop">
    <form className="staff-role-dialog staff-edit-user-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onSubmit={event => { event.preventDefault(); if (!pending) onSave({ name_th: thai.trim() || null, name_en: english.trim() || null }) }}>
      <header><h2 id={titleId}>แก้ไขชื่อแสดงผลอาจารย์</h2></header>
      <p>{originalName} · {email}</p>
      <div className="staff-edit-user-fields">
        <label>ชื่อภาษาไทย<input maxLength={160} value={thai} disabled={pending} onChange={event => setThai(event.target.value)} /></label>
        <label>ชื่อภาษาอังกฤษ<input maxLength={160} value={english} disabled={pending} onChange={event => setEnglish(event.target.value)} /></label>
      </div>
      {error && <p role="alert" className="staff-role-error">{error}</p>}
      <footer>
        <button type="button" disabled={pending} onClick={onClose}>ยกเลิก</button>
        <button className="staff-button" disabled={pending}>{pending ? 'กำลังบันทึก…' : 'บันทึกชื่ออาจารย์'}</button>
      </footer>
    </form>
  </div>
}
