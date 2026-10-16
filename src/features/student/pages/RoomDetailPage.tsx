import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { publicRoomsQuery } from '../../schedules/schedule.queries'
import { ScheduleExplorer } from '../../schedules/components/ScheduleExplorer'
import { RoomDetailContent } from '../../rooms/components/RoomDetailContent'
import { useState } from 'react'
import type { ScheduleCellSelection } from '../../schedules/components/WeeklySchedule'
import { RoomCellActions } from '../components/RoomCellActions'
import type { AuthIdentity } from '../../auth/auth.types'
import { UserBookingForm } from '../../bookings/components/UserBookingForm'
import { UserKeyRequestForm } from '../../keys/components/UserKeyRequestForm'
import type { RoomSlotPermissions } from '../room-actions.service'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'

type UserAction = 'booking' | 'key' | null

export function RoomDetailPage({ identity }: { identity: AuthIdentity | null }) {
  const [selectedCell, setSelectedCell] = useState<ScheduleCellSelection | null>(null)
  const [userAction, setUserAction] = useState<UserAction>(null)
  const [slotPermissions,setSlotPermissions]=useState<RoomSlotPermissions|null>(null)
  const { roomId = '' } = useParams()
  const rooms = useQuery(publicRoomsQuery())
  if (rooms.isPending) return <section className="content-page student-content"><LoadingSpinner label="กำลังโหลดรายละเอียดห้อง…" /></section>
  const room = rooms.data?.find((item) => item.id === roomId)
  if (!room) return <Navigate to="/" replace />
  const closeAction = () => { setSelectedCell(null); setUserAction(null);setSlotPermissions(null) }
  return <section className="content-page student-content"><Link className="back-link" to="/">← กลับไปแผนผังห้อง</Link><RoomDetailContent room={room} /><ScheduleExplorer fixedRoomId={room.id} publicAccess roomRequired rangeMode="sunday-week" bookingWindow limitPublicWeeks onCellSelect={setSelectedCell} />{selectedCell && !userAction && <RoomCellActions roomId={room.id} selection={selectedCell} authenticated={Boolean(identity)} onBook={() => setUserAction('booking')} onRequestKey={(permissions)=>{setSlotPermissions(permissions);setUserAction('key')}} onClose={closeAction} />}{selectedCell && userAction==='booking' && <UserBookingForm roomId={room.id} date={selectedCell.date} time={selectedCell.time} requiresKey={false} onClose={closeAction} />}{selectedCell && userAction==='key'&&slotPermissions&&<UserKeyRequestForm roomId={room.id} classScheduleId={slotPermissions.classScheduleId} bookingId={slotPermissions.ownBookingId} date={selectedCell.date} time={selectedCell.time} onClose={closeAction}/>}</section>
}
