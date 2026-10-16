import { Link } from 'react-router-dom'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { ROOM_MAP_ITEMS } from '../room-map.config'

export function RoomFloorMap({ rooms, mode = 'public' }: { rooms: ScheduleRoom[]; mode?: 'public' | 'admin' }) {
  const roomBasePath = mode === 'admin' ? '/admin/rooms' : '/rooms'
  const roomsByLayoutKey = new Map(rooms.map((room) => [room.layoutKey, room]))
  const meetingRoom = roomsByLayoutKey.get('MEET-FACULTY')
  const mapItems = ROOM_MAP_ITEMS.filter((item) => item.className !== 'faculty-area' && item.className !== 'meeting-room')
  return <section className="floor-map-panel" aria-labelledby="floor-map-title">
    <header><div className="map-title-icon" aria-hidden="true">⌂</div><div><h2 id="floor-map-title">แผนผังห้อง อาคารเรียน ชั้น 4</h2><p>เลือกห้องจากแผนผังเพื่อดูรายละเอียดการจอง</p></div><span>เลือกห้องเพื่อดูรายละเอียด</span></header>
    <div className="floor-map">
      <div className="faculty-cluster"><strong>Faculty Office</strong><div className="faculty-workspace">Faculty<br/>Workstations</div>{meetingRoom && (mode === 'admin' || meetingRoom.active) ? <Link className="faculty-meeting" to={`${roomBasePath}/${meetingRoom.id}`}>{meetingRoom.name}</Link> : <div className="faculty-meeting unavailable">Meeting room</div>}<div className="faculty-system">Reception</div><small>Entrance</small></div>
      {mapItems.map((item, index) => {
        if (item.kind === 'reference') return <div aria-disabled="true" className={`map-space map-reference ${item.className}`} key={`${item.label}-${index}`}><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</div>
        const room = roomsByLayoutKey.get(item.layoutKey)
        const selectable = room && (mode === 'admin' || room.active)
        return selectable ? <Link className={`map-space map-room ${item.className}${room.active ? '' : ' room-inactive'}`} key={item.layoutKey} to={`${roomBasePath}/${room.id}`}>{item.className.startsWith('lab-')&&<b aria-hidden="true">▣</b>}<strong>{room.code}</strong><small>{room.name}</small>{item.detail && <small>{item.detail}</small>}{!room.active && <small>ปิดใช้งาน</small>}</Link> : <div aria-disabled="true" className={`map-space map-reference ${item.className}`} key={item.layoutKey}><strong>{room?.code??item.label}</strong>{room && !room.active ? <small>{room.name}</small> : !room && <small>ยังไม่มีข้อมูลห้อง</small>}</div>
      })}
    </div>
    <footer><span><i className="legend-selectable" /> Room details available</span><span><i className="legend-reference" /> Landmark</span><span><i className="legend-other" /> Different level</span><small>Schematic floor plan · Not to scale</small></footer>
  </section>
}
