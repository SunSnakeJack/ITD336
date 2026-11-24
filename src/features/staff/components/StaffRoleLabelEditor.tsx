import { useId, useLayoutEffect, useRef, type FormEvent } from 'react'
import type { RoleOperation } from '../staff-role-label.service'

export function StaffRoleLabelEditor({ draft, pending, error, onChange, onClose, onSave }: {
  draft: RoleOperation; pending: boolean; error?: string
  onChange: (draft: RoleOperation) => void; onClose: () => void; onSave: () => void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const panel = dialog.current
    const opener = document.activeElement
    panel?.showModal()
    return () => {
      panel?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pending && draft.name.trim() && draft.nameTh.trim()) onSave()
  }
  return <dialog ref={dialog} className="staff-role-editor" aria-labelledby={titleId} onCancel={event => {
    event.preventDefault()
    if (!pending) onClose()
  }}>
    <form onSubmit={submit} className="staff-role-editor-form">
      <header><h2 id={titleId}>{draft.operation === 'CREATE' ? 'เพิ่มบทบาท' : 'แก้ไขบทบาท'}</h2>
        <button type="button" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button></header>
      <fieldset disabled={pending}>
        <label className="staff-field">ชื่อภาษาอังกฤษ<input required maxLength={80} value={draft.name}
          onChange={event => onChange({ ...draft, name: event.target.value })} /></label>
        <label className="staff-field">ชื่อภาษาไทย<input required maxLength={80} value={draft.nameTh}
          onChange={event => onChange({ ...draft, nameTh: event.target.value })} /></label>
        <label className="staff-field">รหัสบทบาท<input required readOnly={draft.operation === 'RENAME'}
          pattern="[A-Z][A-Z0-9_]{1,39}" maxLength={40} value={draft.code}
          onChange={event => onChange({ ...draft, code: event.target.value.toUpperCase() })} /></label>
      </fieldset>
      {error && <p role="alert" className="staff-role-error">{error}</p>}
      <footer><button type="button" className="staff-button secondary" disabled={pending} onClick={onClose}>ยกเลิก</button>
        <button type="submit" className="staff-button" disabled={pending || !draft.name.trim() || !draft.nameTh.trim()}>
          {pending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button></footer>
    </form>
  </dialog>
}
