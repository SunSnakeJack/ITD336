import { Link } from 'react-router-dom'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import keyIcon from '../../../assets/key-tag-hardware.svg'
import './KeyRoomTagCard.css'

interface KeyRoomTagCardProps {
  room: ScheduleRoom
  available: string[]
  schedule: 'loading' | 'error' | 'ready' | 'closed'
}

export function KeyRoomTagCard({ room, available, schedule }: KeyRoomTagCardProps) {
  const isAvailable = room.active && schedule === 'ready' && available.length > 0
  const status = schedule === 'closed' ? 'งดให้บริการวันนี้'
    : !room.active ? 'ไม่พร้อมใช้'
    : schedule === 'loading' ? 'กำลังโหลด…'
    : schedule === 'error' ? 'โหลดตารางไม่สำเร็จ'
    : isAvailable ? 'มีช่วงเวลาว่าง' : 'ไม่มีช่วงเวลาว่าง'
  const content = <>
    <strong>{room.code}</strong>
    <small className={isAvailable ? 'key-tag-available'
      : room.active && schedule === 'ready' ? 'key-tag-unavailable' : undefined}>{status}</small>
    {isAvailable && <span className="key-tag-times">
      <small>เวลาว่างวันนี้</small>
      {available.map((range) => <span key={range}>{range}</span>)}
    </span>}
  </>
  return <article className={schedule === 'closed' ? 'key-tag-room key-tag-room-closed' : 'key-tag-room'}>
    <div className="key-tag-hanger">
      <span className="key-tag-rail" aria-hidden="true" />
      <img className="key-tag-icon" src={keyIcon} alt="" />
      {schedule === 'closed' ? <div className="key-tag-label">{content}</div>
        : <Link className="key-tag-label" aria-label={`ดูรายละเอียด ${room.code}`} to={`/keys/rooms/${room.id}`}>{content}</Link>}
    </div>
  </article>
}
