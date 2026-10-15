export function AdminCellActions({ date, time, onExternalBooking, onAcademicSchedule, onClose }: { date: string; time: string; onExternalBooking: () => void; onAcademicSchedule: () => void; onClose: () => void }) {
  return <div className="cell-actions-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="cell-actions admin-cell-actions" role="dialog" aria-label="เลือกประเภทการใช้ห้อง">
    <header><div><strong>{date} · {time}</strong></div><button aria-label="ปิด" onClick={onClose}>×</button></header>
    <div><button type="button" onClick={onExternalBooking}>จองห้องสำหรับบุคคลภายนอก</button><button type="button" onClick={onAcademicSchedule}>เพิ่มตารางเรียน</button></div>
  </div></div>
}
