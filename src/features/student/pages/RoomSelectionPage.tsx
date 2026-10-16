import { useQuery } from '@tanstack/react-query'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { RoomFloorMap } from '../../rooms/components/RoomFloorMap'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

export function RoomSelectionPage() {
  const rooms = useQuery(publicRoomsQuery())
  return <section className="content-page student-content map-page">{rooms.isPending ? <LoadingSpinner label="กำลังโหลดข้อมูลห้อง…" /> : rooms.error ? <div className="map-load-error" role="alert"><strong>ไม่สามารถโหลดข้อมูลห้องได้</strong><span>กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง</span><button onClick={() => void rooms.refetch()}>ลองใหม่</button></div> : <RoomFloorMap rooms={rooms.data ?? []} />}</section>
}
