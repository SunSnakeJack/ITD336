import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { activeKeyLoansQuery } from '../../keys/key.queries'
import { getBorrowerIdentity } from '../../keys/utils/admin-key.utils'
import { roomsQuery } from '../../rooms/room.queries'
import { BackendLimitation, StaffPage, StaffQueryState } from '../components/StaffPage'
import { bangkokDate, bangkokDateTime, isMeetingRoom } from '../utils/staff-analytics'

function ReportActions({ from, setFrom, to, setTo }: { from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void }) {
  return <div className="staff-toolbar"><div className="staff-field"><label htmlFor="report-from">ตั้งแต่วันที่</label><input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div className="staff-field"><label htmlFor="report-to">ถึงวันที่</label><input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div><button className="staff-button" onClick={() => window.print()}>Export PDF / พิมพ์</button></div>
}

function inRange(iso: string, from: string, to: string) {
  const time = new Date(iso).getTime()
  const fromTime = from ? new Date(`${from}T00:00:00+07:00`).getTime() : Number.NEGATIVE_INFINITY
  const toTime = to ? new Date(`${to}T23:59:59+07:00`).getTime() : Number.POSITIVE_INFINITY
  return time >= fromTime && time <= toTime
}

export function StaffLabReportPage() {
  const query = useQuery(activeKeyLoansQuery())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rows = useMemo(() => (query.data ?? []).filter((loan) => inRange(loan.requested_at, from, to)), [query.data, from, to])
  return <StaffPage eyebrow="Laboratory Report" title="รายงานการใช้ห้องปฏิบัติการ" description="รายงานจาก admin key activity view ตามช่วงเวลาที่เลือก" actions={<span>{rows.length} รายการ</span>}>
    <ReportActions from={from} setFrom={setFrom} to={to} setTo={setTo} />
    <StaffQueryState loading={query.isPending} error={query.error} empty={!rows.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ลำดับ</th><th>วัน/เดือน/ปี</th><th>ห้อง</th><th>ประเภทการใช้</th><th>ผู้ใช้งาน</th><th>เวลาเบิก</th><th>เวลาคืน</th></tr></thead><tbody>{rows.map((loan, index) => { const user = getBorrowerIdentity(loan); return <tr key={loan.id}><td>{index + 1}</td><td>{bangkokDate.format(new Date(loan.requested_at))}</td><td>{loan.roomCode}<small>{loan.roomName}</small></td><td>{loan.usage_source === 'CLASS_SCHEDULE' ? 'ตารางเรียน' : loan.usage_source === 'BOOKING' ? 'การจอง' : 'ใช้ห้องโดยตรง'}</td><td>{user.name}<small>{user.identifier}</small></td><td>{bangkokDateTime.format(new Date(loan.requested_at))}</td><td>{loan.returned_at ? bangkokDateTime.format(new Date(loan.returned_at)) : 'ยังไม่คืน'}</td></tr> })}</tbody></table></div></StaffQueryState>
    <div className="staff-section"><BackendLimitation title="วัตถุประสงค์แบบข้อความยังไม่อยู่ใน view">รายงานใช้ประเภทแหล่งสิทธิ์แทน เพราะ admin key activity view ปัจจุบันไม่คืน purpose และระบบจะไม่ query ข้าม RLS เพื่อเติมข้อมูล</BackendLimitation></div>
  </StaffPage>
}

export function StaffMeetingReportPage() {
  const bookings = useQuery(adminBookingsQuery())
  const rooms = useQuery(roomsQuery())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const meetingCodes = useMemo(() => new Set((rooms.data ?? []).filter(isMeetingRoom).map((room) => room.code)), [rooms.data])
  const rows = useMemo(() => (bookings.data ?? []).filter((booking) => meetingCodes.has(booking.roomCode) && inRange(booking.startsAt, from, to)), [bookings.data, meetingCodes, from, to])
  return <StaffPage eyebrow="Meeting Room Report" title="รายงานการใช้ห้องประชุม" description="รายงานรายการจองห้องประชุมจากข้อมูลจริง" actions={<span>{rows.length} รายการ</span>}>
    <ReportActions from={from} setFrom={setFrom} to={to} setTo={setTo} />
    <StaffQueryState loading={bookings.isPending || rooms.isPending} error={bookings.error || rooms.error} empty={!rows.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ลำดับ</th><th>วัน/เดือน/ปี</th><th>ห้องประชุม</th><th>วัตถุประสงค์</th><th>ผู้ใช้งาน</th><th>เริ่มต้น</th><th>สิ้นสุด</th></tr></thead><tbody>{rows.map((booking, index) => <tr key={booking.id}><td>{index + 1}</td><td>{bangkokDate.format(new Date(booking.startsAt))}</td><td>{booking.roomCode}<small>{booking.roomName}</small></td><td>{booking.purpose}</td><td>{booking.userName}</td><td>{bangkokDateTime.format(new Date(booking.startsAt))}</td><td>{bangkokDateTime.format(new Date(booking.endsAt))}</td></tr>)}</tbody></table></div></StaffQueryState>
  </StaffPage>
}
