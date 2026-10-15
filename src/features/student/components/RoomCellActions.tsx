import type { ScheduleCellSelection } from '../../schedules/components/WeeklySchedule'

export function RoomCellActions({ selection, onClose }: { selection: ScheduleCellSelection; onClose: () => void }) {
  return <div className="cell-actions-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="cell-actions" role="dialog" aria-label="ตัวเลือกการใช้ห้อง">
    <header><div><strong>{selection.date} · {selection.time}</strong>{selection.event && <small>{selection.event.title}</small>}{selection.holiday && <small>วันหยุด</small>}</div><button aria-label="ปิด" onClick={onClose}>×</button></header>
    <div><button type="button">จองห้อง</button><button type="button">เบิกกุญแจ</button></div>
  </div></div>
}
