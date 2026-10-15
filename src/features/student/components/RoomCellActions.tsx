import type { ScheduleCellSelection } from '../../schedules/components/WeeklySchedule'
import { useNavigate } from 'react-router-dom'

export function RoomCellActions({ selection, onClose }: { selection: ScheduleCellSelection; onClose: () => void }) {
  const navigate = useNavigate()
  const goToLogin = () => { onClose(); navigate('/login') }
  return <div className="cell-actions-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="cell-actions" role="dialog" aria-label="ตัวเลือกการใช้ห้อง">
    <header><div><strong>{selection.date} · {selection.time}</strong>{selection.event && <small>{selection.event.title}</small>}{selection.holiday && <small>วันหยุด</small>}</div><button aria-label="ปิด" onClick={onClose}>×</button></header>
    <div><button type="button" onClick={goToLogin}>จองห้อง</button><button type="button" onClick={goToLogin}>เบิกกุญแจ</button></div>
  </div></div>
}
