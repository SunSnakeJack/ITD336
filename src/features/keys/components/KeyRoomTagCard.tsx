import { Link } from 'react-router-dom'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import keyIcon from '../../../assets/key-tag-hardware.svg'
import './KeyRoomTagCard.css'

interface KeyRoomTagCardProps {
  room: ScheduleRoom
  available: string[]
  schedule: 'loading' | 'error' | 'ready'
  requestPath?: string
  onSignIn?: () => void
}

export function KeyRoomTagCard({ room, available, schedule, requestPath, onSignIn }: KeyRoomTagCardProps) {
  const isAvailable = room.active && schedule === 'ready' && available.length > 0
  const status = !room.active ? 'ไม่พร้อมใช้'
    : schedule === 'loading' ? 'กำลังโหลด…'
    : schedule === 'error' ? 'โหลดตารางไม่สำเร็จ'
    : isAvailable ? 'มีช่วงเวลาว่าง' : 'ไม่มีช่วงเวลาว่าง'
  const content = <>
    <strong>{room.code}</strong>
    <small className={isAvailable ? 'key-tag-available' : undefined}>{status}</small>
    {isAvailable && <span className="key-tag-times">
      <small>เวลาว่างวันนี้</small>
      {available.map((range) => <span key={range}>{range}</span>)}
    </span>}
  </>
  const actionLabel = `เบิกกุญแจ ${room.code}`

  return <article className="key-tag-room">
    <div className="key-tag-hanger">
      <span className="key-tag-rail" aria-hidden="true" />
      <img className="key-tag-icon" src={keyIcon} alt="" />
      {requestPath ? onSignIn
        ? <button className="key-tag-label" type="button" aria-label={actionLabel} onClick={onSignIn}>{content}</button>
        : <Link className="key-tag-label" aria-label={actionLabel} to={requestPath}>{content}</Link>
        : <div className="key-tag-label">{content}</div>}
    </div>
    <Link className="key-tag-details" aria-label={`ดูรายละเอียด ${room.code}`} to={`/keys/rooms/${room.id}`}>ดูรายละเอียด</Link>
  </article>
}
