import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { ScheduleExplorer } from '../../schedules/components/ScheduleExplorer'
import { RoomDetailContent } from '../../rooms/components/RoomDetailContent'
import { useState } from 'react'
import type { ScheduleCellSelection } from '../../schedules/components/WeeklySchedule'
import { RoomCellActions } from '../components/RoomCellActions'

export function RoomDetailPage() {
  const [selectedCell, setSelectedCell] = useState<ScheduleCellSelection | null>(null)
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  if (rooms.isPending) return <section className="content-page student-content"><div className="empty-panel">กำลังโหลดรายละเอียดห้อง…</div></section>
  const room = rooms.data?.find((item) => item.id === roomId)
  if (!room) return <Navigate to="/" replace />
  return <section className="content-page student-content"><Link className="back-link" to="/">← กลับไปแผนผังห้อง</Link><RoomDetailContent room={room} /><ScheduleExplorer fixedRoomId={room.id} publicAccess roomRequired hideToolbar onCellSelect={setSelectedCell} />{selectedCell && <RoomCellActions selection={selectedCell} onClose={() => setSelectedCell(null)} />}</section>
}
