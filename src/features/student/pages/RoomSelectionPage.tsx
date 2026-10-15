import { useQuery } from '@tanstack/react-query'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { RoomFloorMap } from '../../rooms/components/RoomFloorMap'

export function RoomSelectionPage() {
  const rooms = useQuery(publicRoomsQuery())
  return <section className="content-page student-content map-page">{rooms.isPending ? <div className="floor-map-skeleton" aria-label="กำลังโหลดข้อมูลห้อง"><span /><span /><span /><span /></div> : rooms.error ? <div className="map-load-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><span>กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</span><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : <RoomFloorMap rooms={rooms.data ?? []} />}</section>
}
