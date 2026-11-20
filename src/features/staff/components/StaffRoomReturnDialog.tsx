import { useId } from 'react'

interface StaffRoomReturnDialogProps {
  roomCode: string
  count?: number
  loading: boolean
  pending: boolean
  error?: string
  onClose: () => void
  onConfirm: () => void
}

export function StaffRoomReturnDialog({ roomCode, count, loading, pending, error, onClose, onConfirm }: StaffRoomReturnDialogProps) {
  const titleId = useId()
  return <div className="staff-decision-backdrop" role="presentation"
    onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <section className="staff-decision-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
      onKeyDown={event => { if (event.key === 'Escape' && !pending) onClose() }}>
      <header><h2 id={titleId}>ยืนยันรับกุญแจ</h2><button type="button" aria-label="ปิด" onClick={onClose} disabled={pending}>×</button></header>
      <p>ได้รับกุญแจห้อง {roomCode} แล้วใช่ไหม?</p>
      {loading && <p role="status">กำลังตรวจสอบรายการเกินกำหนด…</p>}
      {count === 0 && <p>ไม่มีรายการเกินกำหนดที่ต้องอัปเดตแล้ว</p>}
      {count !== undefined && count > 0 && <p>ระบบจะอัปเดตรายการเกินกำหนดของห้องนี้ {count} รายการเป็นคืนแล้ว</p>}
      {error && <p className="staff-role-error" role="alert">{error}</p>}
      <footer>
        <button type="button" autoFocus onClick={onClose} disabled={pending}>ยกเลิก</button>
        <button type="button" className="confirm" onClick={onConfirm} disabled={loading || pending || !count}>{pending ? 'กำลังบันทึก…' : 'ยืนยันว่าได้รับกุญแจ'}</button>
      </footer>
    </section>
  </div>
}
