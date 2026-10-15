import type { ReactNode } from 'react'
import type { ScheduleRoom } from '../../schedules/schedule.types'

export function RoomDetailContent({ room, action }: { room: ScheduleRoom; action?: ReactNode }) {
  return <div className="room-detail-heading">
    <div><span>{room.roomTypeName}</span><h1>{room.code}</h1><h2>{room.name}</h2></div>
    <div className="room-detail-meta"><dl><div><dt>อาคาร / ชั้น</dt><dd>{[room.building, room.floor].filter(Boolean).join(' · ') || 'ไม่ระบุ'}</dd></div><div><dt>ความจุ</dt><dd>{room.capacity} คน</dd></div><div><dt>สถานะ</dt><dd>{room.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</dd></div></dl>{action}</div>
  </div>
}
