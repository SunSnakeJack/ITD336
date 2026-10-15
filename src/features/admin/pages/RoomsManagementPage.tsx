import { useQuery } from '@tanstack/react-query'
import { RoomFloorMap } from '../../rooms/components/RoomFloorMap'
import { roomsQuery } from '../../schedules/schedule.queries'

export function RoomsManagementPage() {
  const rooms = useQuery(roomsQuery())
  return <section className="content-page admin-room-map-page"><div className="page-heading"><div><span>ROOM MANAGEMENT</span><h1>จัดการห้อง</h1><p>เลือกห้องจากแผนผังเพื่อดูตารางและเปลี่ยนสถานะการใช้งาน</p></div></div>
    {rooms.isPending ? <div className="floor-map-skeleton" aria-label="กำลังโหลดข้อมูลห้อง"><span /><span /><span /><span /></div> : rooms.error ? <p className="panel-error">{rooms.error.message}</p> : <RoomFloorMap rooms={rooms.data ?? []} mode="admin" />}
  </section>
}
