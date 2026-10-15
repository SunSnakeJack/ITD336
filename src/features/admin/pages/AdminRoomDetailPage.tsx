import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ExternalBookingForm } from '../../bookings/components/ExternalBookingForm'
import { CellScheduleForm } from '../../schedules/components/CellScheduleForm'
import { ScheduleExplorer } from '../../schedules/components/ScheduleExplorer'
import { roomsQuery } from '../../schedules/schedule.queries'
import { AdminCellActions } from '../components/AdminCellActions'
import { AdminRoomDetailsCard } from '../components/AdminRoomDetailsCard'

type CellDialog = { date: string; time: string; sourceId?: string; mode: 'choose' | 'schedule' | 'external' }

export function AdminRoomDetailPage() {
  const [selectedCell, setSelectedCell] = useState<CellDialog | null>(null)
  const { roomId = '' } = useParams()
  const rooms = useQuery(roomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  if (rooms.isPending) return <section className="content-page"><div className="empty-panel">กำลังโหลดรายละเอียดห้อง…</div></section>
  if (!room) return <Navigate to="/admin/rooms" replace />
  return <section className="content-page"><Link className="back-link" to="/admin/rooms">← กลับไปแผนผังห้อง</Link>
    <AdminRoomDetailsCard room={room} />
    <div className="detail-schedule-title"><h2>ตารางเวลาห้อง</h2><p>คลิกช่องว่างเพื่อเลือกประเภทการใช้งาน หรือคลิกตารางเรียนสีส้มเพื่อแก้ไขทั้งภาคเรียน</p></div>
    <ScheduleExplorer fixedRoomId={room.id} roomRequired rangeMode="calendar-week" onEmptyCellSelect={(date, time) => setSelectedCell({ date, time, mode: 'choose' })} onEventSelect={(event) => setSelectedCell({ date: event.startsAt.slice(0, 10), time: event.startsAt.slice(11, 16), sourceId: event.sourceId, mode: event.eventType === 'BOOKING' ? 'external' : 'schedule' })} />
    {selectedCell?.mode === 'choose' && <AdminCellActions date={selectedCell.date} time={selectedCell.time} onClose={() => setSelectedCell(null)} onExternalBooking={() => setSelectedCell({ ...selectedCell, mode: 'external' })} onAcademicSchedule={() => setSelectedCell({ ...selectedCell, mode: 'schedule' })} />}
    {selectedCell?.mode === 'schedule' && <CellScheduleForm roomId={room.id} date={selectedCell.date} time={selectedCell.time} scheduleId={selectedCell.sourceId} onClose={() => setSelectedCell(null)} />}
    {selectedCell?.mode === 'external' && <ExternalBookingForm roomId={room.id} date={selectedCell.date} time={selectedCell.time} bookingId={selectedCell.sourceId} onClose={() => setSelectedCell(null)} />}
  </section>
}
