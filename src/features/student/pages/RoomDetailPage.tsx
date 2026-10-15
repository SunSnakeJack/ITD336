import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { ScheduleExplorer } from '../../schedules/components/ScheduleExplorer'
import { RoomDetailContent } from '../../rooms/components/RoomDetailContent'

export function RoomDetailPage() {
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  if (rooms.isPending) return <section className="content-page student-content"><div className="empty-panel">กำลังโหลดรายละเอียดห้อง…</div></section>
  const room = rooms.data?.find((item) => item.id === roomId)
  if (!room) return <Navigate to="/" replace />
  return <section className="content-page student-content"><Link className="back-link" to="/">← กลับไปแผนผังห้อง</Link><RoomDetailContent room={room} /><div className="detail-schedule-title"><h2>ตารางเวลาห้อง</h2><p>ช่วงเวลาใช้งาน 7 วัน เริ่มจากวันที่เลือก</p></div><ScheduleExplorer fixedRoomId={room.id} publicAccess roomRequired /></section>
}
