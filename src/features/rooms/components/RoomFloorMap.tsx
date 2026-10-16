import { Link } from 'react-router-dom'
import type { ScheduleRoom } from '../../schedules/schedule.types'
import { ROOM_MAP_ITEMS } from '../room-map.config'

export function RoomFloorMap({ rooms, mode = 'public' }: { rooms: ScheduleRoom[]; mode?: 'public' | 'admin' }) {
  const roomBasePath = mode === 'admin' ? '/admin/rooms' : '/rooms'
  const roomsByLayoutKey = new Map(rooms.map((room) => [room.layoutKey, room]))
  const meetingRoom = roomsByLayoutKey.get('MEET-FACULTY')
  const mapItems = ROOM_MAP_ITEMS.filter((item) => item.className !== 'faculty-area' && item.className !== 'meeting-room')
  return <section className="floor-map-panel" aria-labelledby="floor-map-title">
    <header><div><h2 id="floor-map-title">แผนผังห้อง</h2><p>ชั้น 4 และห้องพิเศษบริเวณชั้นลอย</p></div><span>⌁ คลิกห้องเพื่อดูรายละเอียด</span></header>
    <div className="floor-map">
      <div className="faculty-cluster"><strong>ห้องคณะ ITD</strong><div className="faculty-workspace">โต๊ะทำงานอาจารย์</div>{meetingRoom && (mode === 'admin' || meetingRoom.active) ? <Link className="faculty-meeting" to={`${roomBasePath}/${meetingRoom.id}`}>{meetingRoom.name}<span>↗</span></Link> : <div className="faculty-meeting unavailable">ห้องประชุมคณะ</div>}<div className="faculty-system">โต๊ะระบบ</div><small>ประตู</small></div>
      {mapItems.map((item, index) => {
        if (item.kind === 'reference') return <div aria-disabled="true" className={`map-space map-reference ${item.className}`} key={`${item.label}-${index}`}><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</div>
        const room = roomsByLayoutKey.get(item.layoutKey)
        const selectable = room && (mode === 'admin' || room.active)
        return selectable ? <Link className={`map-space map-room ${item.className}${room.active ? '' : ' room-inactive'}`} key={item.layoutKey} to={`${roomBasePath}/${room.id}`}><strong>{room.name}</strong><small>{room.code}</small>{item.detail && <small>{item.detail}</small>}{!room.active && <small>ปิดใช้งาน</small>}<span>↗</span></Link> : <div aria-disabled="true" className={`map-space map-reference ${item.className}`} key={item.layoutKey}><strong>{item.label}</strong>{room && !room.active ? <small>ปิดใช้งาน</small> : !room && <small>ยังไม่มีข้อมูลห้อง</small>}</div>
      })}
    </div>
    <footer><span><i className="legend-selectable" /> กดดูห้องได้</span><span><i className="legend-reference" /> จุดอ้างอิง</span><span><i className="legend-other" /> ห้องต่างชั้น</span><small>แผนผังโดยสังเขป · ไม่ใช่มาตราส่วนจริง</small></footer>
  </section>
}
