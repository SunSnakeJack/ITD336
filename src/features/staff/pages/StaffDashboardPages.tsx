import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { activeKeyLoansQuery, keyCabinetRoomsQuery } from '../../keys/key.queries'
import { getBorrowerIdentity } from '../../keys/utils/admin-key.utils'
import { roomsQuery } from '../../rooms/room.queries'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { aggregateBookingsByMonth, bangkokDateTime, isFuture, isMeetingRoom, mostFrequentUsers } from '../utils/staff-analytics'

function MonthlyChart({ values }: { values: ReturnType<typeof aggregateBookingsByMonth> }) {
  const max = Math.max(...values.map((item) => item.count), 1)
  return <div className="staff-chart" aria-label="จำนวนการใช้งานรายเดือน">{values.slice(-6).map((item) => <div key={item.key}><b>{item.count}</b><i style={{ height: `${Math.max((item.count / max) * 130, 3)}px` }} /><small>{item.label}</small></div>)}</div>
}

export function StaffLabDashboardPage() {
  const cabinet = useQuery(keyCabinetRoomsQuery())
  const loans = useQuery(activeKeyLoansQuery())
  const checkedOut = cabinet.data?.filter((room) => room.keyStatus === 'CHECKED_OUT').length ?? 0
  const overdue = cabinet.data?.filter((room) => room.keyStatus === 'OVERDUE').length ?? 0
  const recent = (loans.data ?? []).slice(0, 20)
  const users = useMemo(() => {
    const counts = new Map<string, number>()
    for (const loan of loans.data ?? []) { const name = getBorrowerIdentity(loan).name; counts.set(name, (counts.get(name) ?? 0) + 1) }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [loans.data])
  return <StaffPage eyebrow="Laboratory Analytics" title="Dashboard ห้องปฏิบัติการ" description="ภาพรวมจากสถานะตู้กุญแจและ admin key activity ปัจจุบัน">
    <div className="staff-grid staff-grid-4"><article className="staff-card staff-stat"><small>ห้องในตู้กุญแจ</small><strong>{cabinet.data?.length ?? '—'}</strong></article><article className="staff-card staff-stat"><small>กำลังถือกุญแจ</small><strong>{cabinet.isPending ? '—' : checkedOut}</strong></article><article className="staff-card staff-stat"><small>เกินกำหนด</small><strong>{cabinet.isPending ? '—' : overdue}</strong></article><article className="staff-card staff-stat"><small>กิจกรรมที่เข้าถึงได้</small><strong>{loans.data?.length ?? '—'}</strong></article></div>
    <div className="staff-grid staff-grid-3 staff-section"><article className="staff-card"><h3>สถานะห้องปัจจุบัน</h3><StaffQueryState loading={cabinet.isPending} error={cabinet.error} empty={!cabinet.data?.length}>{cabinet.data?.slice(0, 8).map((room) => <p key={room.roomId}>{room.roomCode} <StatusBadge status={room.keyStatus === 'ROOM_CLOSED' ? 'INACTIVE' : room.keyStatus} /></p>)}</StaffQueryState></article><article className="staff-card"><h3>ผู้ใช้งานสูงสุด</h3>{users.length ? users.map(([name, count], index) => <p key={name}>{index + 1}. {name} <strong>({count})</strong></p>) : <p>ยังไม่มีข้อมูล</p>}</article><article className="staff-card"><h3>หลักการคำนวณ</h3><p>นับเฉพาะรายการที่ admin activity view อนุญาตให้บัญชีปัจจุบันอ่านได้ จึงไม่แสดงตัวเลขจำลองหรือสรุปข้อมูลที่ Backend ไม่คืนมา</p></article></div>
    <section className="staff-section"><div className="staff-section-head"><h3>กิจกรรมล่าสุด 20 รายการ</h3></div><StaffQueryState loading={loans.isPending} error={loans.error} empty={!recent.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้ใช้</th><th>ห้อง</th><th>วันที่ขอ</th><th>กำหนดคืน</th><th>สถานะ</th></tr></thead><tbody>{recent.map((loan) => <tr key={loan.id}><td>{getBorrowerIdentity(loan).name}</td><td>{loan.roomCode}</td><td>{bangkokDateTime.format(new Date(loan.requested_at))}</td><td>{loan.expected_return_at ? bangkokDateTime.format(new Date(loan.expected_return_at)) : '—'}</td><td><StatusBadge status={loan.status} /></td></tr>)}</tbody></table></div></StaffQueryState></section>
  </StaffPage>
}

export function StaffMeetingDashboardPage() {
  const bookings = useQuery(adminBookingsQuery())
  const rooms = useQuery(roomsQuery())
  const meetingCodes = useMemo(() => new Set((rooms.data ?? []).filter(isMeetingRoom).map((room) => room.code)), [rooms.data])
  const meetingBookings = useMemo(() => (bookings.data ?? []).filter((booking) => meetingCodes.has(booking.roomCode)), [bookings.data, meetingCodes])
  const upcoming = meetingBookings.filter((booking) => isFuture(booking.startsAt) && !['CANCELLED', 'REJECTED'].includes(booking.status))
  const cancelled = meetingBookings.filter((booking) => booking.status === 'CANCELLED' && isFuture(booking.startsAt))
  const monthly = aggregateBookingsByMonth(meetingBookings.filter((booking) => !['CANCELLED', 'REJECTED'].includes(booking.status)))
  const users = mostFrequentUsers(meetingBookings)
  const loading = bookings.isPending || rooms.isPending
  return <StaffPage eyebrow="Meeting Analytics" title="Dashboard ห้องประชุม" description="KPI และแนวโน้มจากรายการจองห้องประชุมจริง">
    <div className="staff-grid staff-grid-4"><article className="staff-card staff-stat"><small>ห้องประชุม</small><strong>{rooms.isPending ? '—' : meetingCodes.size}</strong></article><article className="staff-card staff-stat"><small>รายการจองล่วงหน้า</small><strong>{loading ? '—' : upcoming.length}</strong></article><article className="staff-card staff-stat"><small>ยกเลิกล่วงหน้า</small><strong>{loading ? '—' : cancelled.length}</strong></article><article className="staff-card staff-stat"><small>รายการทั้งหมด</small><strong>{loading ? '—' : meetingBookings.length}</strong></article></div>
    <div className="staff-grid staff-grid-3 staff-section"><article className="staff-card"><h3>จำนวนการใช้ห้องต่อเดือน</h3>{monthly.length ? <MonthlyChart values={monthly} /> : <p>ยังไม่มีข้อมูลสำหรับกราฟ</p>}</article><article className="staff-card"><h3>ผู้ใช้งานสูงสุด</h3>{users.length ? users.map(([name, count], index) => <p key={name}>{index + 1}. {name} <strong>({count})</strong></p>) : <p>ยังไม่มีข้อมูล</p>}</article><article className="staff-card"><h3>รายการจองล่วงหน้า 5 รายการ</h3>{upcoming.slice(0, 5).map((booking) => <p key={booking.id}><strong>{booking.roomCode}</strong> · {booking.userName}<small>{bangkokDateTime.format(new Date(booking.startsAt))}</small></p>)}</article></div>
    <section className="staff-section"><h3>รายการใช้งานล่าสุด 10 รายการ</h3><StaffQueryState loading={loading} error={bookings.error || rooms.error} empty={!meetingBookings.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้ใช้</th><th>ห้อง</th><th>เริ่มต้น</th><th>วัตถุประสงค์</th><th>สถานะ</th></tr></thead><tbody>{meetingBookings.slice(0, 10).map((booking) => <tr key={booking.id}><td>{booking.userName}</td><td>{booking.roomCode}</td><td>{bangkokDateTime.format(new Date(booking.startsAt))}</td><td>{booking.purpose}</td><td><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div></StaffQueryState></section>
  </StaffPage>
}
