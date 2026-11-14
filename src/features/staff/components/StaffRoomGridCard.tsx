import { Link } from 'react-router-dom'
import type { Room } from '../../rooms/room.types'
import defaultRoomImage from '../../../assets/default-room.jpg'
import { StatusBadge } from './StaffPage'

export function StaffRoomGridCard({ room, typeLabel }: { room: Room; typeLabel: string }) {
  const detailPath = `/staff/rooms/${room.id}`
  return <article className="staff-room-grid-card">
    <div className="staff-room-grid-media">
      <img src={room.image_url || defaultRoomImage} alt={room.image_url ? room.name : 'รูปตัวอย่างห้อง'} loading="lazy"
        onError={event => {
          if (event.currentTarget.getAttribute('src') !== defaultRoomImage) event.currentTarget.src = defaultRoomImage
        }} />
      <div className="staff-room-grid-status"><StatusBadge status={room.active ? 'ACTIVE' : 'INACTIVE'} /></div>
    </div>
    <div className="staff-room-grid-content">
      <h3>{room.code}</h3>
      <p>{room.name}</p>
      <p className="staff-room-grid-meta">{typeLabel} · {room.capacity} คน</p>
      <p className="staff-room-grid-meta">เปิดให้จอง: {room.booking_enabled ? 'เปิด' : 'ปิด'}</p>
      <div className="staff-room-grid-actions">
        <Link className="staff-button" to={detailPath + '/edit'}>แก้ไขรายละเอียดห้อง</Link>
        <Link className="staff-button secondary" to={detailPath}>รายละเอียด</Link>
      </div>
    </div>
  </article>
}
