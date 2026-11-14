import { useQuery } from '@tanstack/react-query'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { StaffQueryState, StatusBadge } from './StaffPage'

const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })

export function RoomBookingHistory({ roomCode }: { roomCode: string }) {
  const query = useQuery(adminBookingsQuery())
  const bookings = (query.data ?? []).filter(item => item.roomCode === roomCode).sort((a, b) => b.startsAt.localeCompare(a.startsAt))
  return <section className="staff-card staff-room-history"><h3>ประวัติการจองห้อง</h3>
    <StaffQueryState loading={query.isPending} error={query.error} empty={!bookings.length} emptyText="ยังไม่มีประวัติการจองห้องนี้">
      <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้จอง</th><th>เวลาเริ่ม–สิ้นสุด</th><th>วัตถุประสงค์</th><th>สถานะ</th></tr></thead><tbody>{bookings.map(item => <tr key={item.id}><td>{item.userName}</td><td>{dateTime.format(new Date(item.startsAt))}<small>{dateTime.format(new Date(item.endsAt))}</small></td><td>{item.purpose}</td><td><StatusBadge status={item.status}/></td></tr>)}</tbody></table></div>
    </StaffQueryState>
  </section>
}
