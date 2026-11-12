import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { activeKeyLoansQuery } from '../../keys/key.queries'
import { getBorrowerIdentity } from '../../keys/utils/admin-key.utils'
import { roomsQuery } from '../../rooms/room.queries'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { bangkokDateTime, isMeetingRoom } from '../utils/staff-analytics'

function HistoryToolbar({ search, setSearch, date, setDate, placeholder }: { search: string; setSearch: (value: string) => void; date: string; setDate: (value: string) => void; placeholder: string }) {
  return <div className="staff-toolbar"><div className="staff-field grow"><label htmlFor="history-search">ค้นหา</label><input id="history-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></div><div className="staff-field"><label htmlFor="history-date">วันที่</label><input id="history-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>
}

export function StaffLabHistoryPage() {
  const query = useQuery(activeKeyLoansQuery())
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const rows = useMemo(() => (query.data ?? []).filter((loan) => {
    const borrower = getBorrowerIdentity(loan)
    const matchesText = `${borrower.name} ${borrower.identifier} ${loan.roomCode} ${loan.roomName}`.toLocaleLowerCase('th').includes(search.toLocaleLowerCase('th'))
    const matchesDate = !date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(loan.requested_at)) === date
    return matchesText && matchesDate
  }), [query.data, search, date])
  return <StaffPage eyebrow="Usage History" title="ประวัติการใช้ห้องปฏิบัติการ" description="ประวัติการเบิกและคืนกุญแจเท่าที่ admin activity view เปิดเผย">
    <HistoryToolbar search={search} setSearch={setSearch} date={date} setDate={setDate} placeholder="ชื่อผู้ใช้ รหัส หรือห้อง" />
    <StaffQueryState loading={query.isPending} error={query.error} empty={!rows.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้ใช้งาน</th><th>ห้อง</th><th>วันที่ขอ</th><th>กำหนดคืน</th><th>คืนจริง</th><th>สถานะ</th></tr></thead><tbody>{rows.map((loan) => { const user = getBorrowerIdentity(loan); return <tr key={loan.id}><td>{user.name}<small>{user.identifier}</small></td><td>{loan.roomCode}<small>{loan.roomName}</small></td><td>{bangkokDateTime.format(new Date(loan.requested_at))}</td><td>{loan.expected_return_at ? bangkokDateTime.format(new Date(loan.expected_return_at)) : '—'}</td><td>{loan.returned_at ? bangkokDateTime.format(new Date(loan.returned_at)) : '—'}</td><td><StatusBadge status={loan.status} /></td></tr> })}</tbody></table></div></StaffQueryState>
  </StaffPage>
}

export function StaffMeetingHistoryPage() {
  const bookings = useQuery(adminBookingsQuery())
  const rooms = useQuery(roomsQuery())
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const meetingCodes = useMemo(() => new Set((rooms.data ?? []).filter(isMeetingRoom).map((room) => room.code)), [rooms.data])
  const rows = useMemo(() => (bookings.data ?? []).filter((booking) => {
    const matchesText = `${booking.userName} ${booking.roomCode} ${booking.roomName} ${booking.purpose}`.toLocaleLowerCase('th').includes(search.toLocaleLowerCase('th'))
    const matchesDate = !date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(booking.startsAt)) === date
    return meetingCodes.has(booking.roomCode) && matchesText && matchesDate
  }), [bookings.data, meetingCodes, search, date])
  return <StaffPage eyebrow="Usage History" title="ประวัติการใช้ห้องประชุม" description="รายการจองห้องประชุมย้อนหลังจาก booking details view">
    <HistoryToolbar search={search} setSearch={setSearch} date={date} setDate={setDate} placeholder="ผู้จอง ห้อง หรือวัตถุประสงค์" />
    <StaffQueryState loading={bookings.isPending || rooms.isPending} error={bookings.error || rooms.error} empty={!rows.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้ใช้งาน</th><th>ห้องประชุม</th><th>เริ่มต้น</th><th>สิ้นสุด</th><th>วัตถุประสงค์</th><th>สถานะ</th></tr></thead><tbody>{rows.map((booking) => <tr key={booking.id}><td>{booking.userName}<small>{booking.bookingCode}</small></td><td>{booking.roomCode}<small>{booking.roomName}</small></td><td>{bangkokDateTime.format(new Date(booking.startsAt))}</td><td>{bangkokDateTime.format(new Date(booking.endsAt))}</td><td>{booking.purpose}</td><td><StatusBadge status={booking.status} /></td></tr>)}</tbody></table></div></StaffQueryState>
  </StaffPage>
}
