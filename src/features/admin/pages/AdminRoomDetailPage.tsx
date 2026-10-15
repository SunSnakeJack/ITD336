import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { RoomDetailContent } from '../../rooms/components/RoomDetailContent'
import { ScheduleExplorer } from '../../schedules/components/ScheduleExplorer'
import { roomsQuery, scheduleKeys } from '../../schedules/schedule.queries'
import { updateRoomAvailability } from '../../schedules/schedule.service'
import { CellScheduleForm } from '../../schedules/components/CellScheduleForm'
import { useState } from 'react'

export function AdminRoomDetailPage() {
  const [selectedCell, setSelectedCell] = useState<{ date: string; time: string; scheduleId?: string } | null>(null)
  const { roomId = '' } = useParams()
  const client = useQueryClient()
  const rooms = useQuery(roomsQuery())
  const room = rooms.data?.find((item) => item.id === roomId)
  const availability = useMutation({ mutationFn: (active: boolean) => updateRoomAvailability(roomId, active), onSuccess: () => client.invalidateQueries({ queryKey: scheduleKeys.rooms() }) })
  if (rooms.isPending) return <section className="content-page"><div className="empty-panel">กำลังโหลดรายละเอียดห้อง…</div></section>
  if (!room) return <Navigate to="/admin/rooms" replace />
  const toggle = () => {
    const nextState = !room.active
    if (window.confirm(`ยืนยันการ${nextState ? 'เปิด' : 'ปิด'}ใช้งานห้อง ${room.code}?`)) availability.mutate(nextState)
  }
  return <section className="content-page"><Link className="back-link" to="/admin/rooms">← กลับไปแผนผังห้อง</Link>
    <RoomDetailContent room={room} action={<button className={`room-availability-action ${room.active ? 'close' : 'open'}`} disabled={availability.isPending} onClick={toggle}>{availability.isPending ? 'กำลังบันทึก…' : room.active ? 'ปิดใช้งานห้อง' : 'เปิดใช้งานห้อง'}</button>} />
    {availability.error && <p className="panel-error">{availability.error.message}</p>}
    <div className="detail-schedule-title"><h2>ตารางเวลาห้อง</h2><p>คลิกช่องว่างเพื่อเพิ่ม หรือคลิกตารางเรียนสีส้มเพื่อแก้ไขทั้งภาคเรียน</p></div><ScheduleExplorer fixedRoomId={room.id} roomRequired rangeMode="calendar-week" onEmptyCellSelect={(date, time) => setSelectedCell({ date, time })} onEventSelect={(event) => setSelectedCell({ date: event.startsAt.slice(0, 10), time: event.startsAt.slice(11, 16), scheduleId: event.sourceId })} />
    {selectedCell && <CellScheduleForm roomId={room.id} date={selectedCell.date} time={selectedCell.time} scheduleId={selectedCell.scheduleId} onClose={() => setSelectedCell(null)} />}
  </section>
}
