import { Link } from 'react-router-dom'
import type { Room } from '../../rooms/room.types'
import defaultRoomImage from '../../../assets/default-room.jpg'
import { StatusBadge } from './StaffPage'
import { StaffIcon } from './StaffIcon'

export function StaffRoomGridCard({ room, equipmentSummary }: { room: Room; equipmentSummary: string }) {
  const detailPath = `/staff/rooms/${room.id}`
  return <article className="staff-room-grid-card">
    <div className="staff-room-grid-media">
      <img src={room.image_url || defaultRoomImage} alt={room.image_url ? room.name : 'รูปตัวอย่างห้อง'} loading="lazy"
        onError={event => {
          if (event.currentTarget.getAttribute('src') !== defaultRoomImage) event.currentTarget.src = defaultRoomImage
        }} />
    </div>
    <div className="staff-room-grid-content">
      <header className="staff-room-grid-heading">
        <h3>{room.code}</h3>
        <StatusBadge status={room.active ? 'ACTIVE' : 'INACTIVE'} />
      </header>
      <dl className="staff-room-grid-meta">
        <div><dt><StaffIcon name="person" /> ความจุ</dt><dd>{room.capacity == null ? '—' : `${room.capacity} ที่นั่ง`}</dd></div>
        <div><dt><StaffIcon name="monitor" /> อุปกรณ์</dt><dd title={equipmentSummary}>{equipmentSummary}</dd></div>
      </dl>
      <div className="staff-room-grid-actions">
        <Link className="staff-button secondary" to={detailPath}>รายละเอียด</Link>
        <Link className="staff-button" to={detailPath + '/edit'}>แก้ไข</Link>
      </div>
    </div>
  </article>
}
