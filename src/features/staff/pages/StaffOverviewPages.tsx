import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { keyCabinetRoomsQuery } from '../../keys/key.queries'
import { roomQuery, roomsQuery } from '../../rooms/room.queries'
import { BackendLimitation, StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { filterRooms, isMeetingRoom, type RoomStatusFilter } from '../utils/staff-analytics'

export function StaffHomePage() {
  const rooms = useQuery(roomsQuery())
  const bookings = useQuery(adminBookingsQuery())
  const keys = useQuery(keyCabinetRoomsQuery())
  const pending = bookings.data?.filter((item) => item.status === 'PENDING').length ?? 0
  const held = keys.data?.filter((item) => item.keyStatus === 'CHECKED_OUT' || item.keyStatus === 'OVERDUE').length ?? 0
  return <StaffPage eyebrow="Staff Home" title="ภาพรวมระบบ" description="สถานะสำคัญและทางลัดสำหรับงานเจ้าหน้าที่">
    <div className="staff-grid staff-grid-4">
      <article className="staff-card staff-stat"><small>ห้องทั้งหมด</small><strong>{rooms.data?.length ?? '—'}</strong><Link to="/staff/rooms">ดูข้อมูลห้อง</Link></article>
      <article className="staff-card staff-stat"><small>ห้องเปิดใช้งาน</small><strong>{rooms.data?.filter((room) => room.active).length ?? '—'}</strong><Link to="/staff/rooms">ตรวจสอบสถานะ</Link></article>
      <article className="staff-card staff-stat"><small>รายการรอดำเนินการ</small><strong>{bookings.isPending ? '—' : pending}</strong><Link to="/staff/meeting-rooms">ดูรายการจอง</Link></article>
      <article className="staff-card staff-stat"><small>ห้องที่มีกุญแจถูกถือ</small><strong>{keys.isPending ? '—' : held}</strong><Link to="/staff/key-requests">ดูสถานะกุญแจ</Link></article>
    </div>
    <div className="staff-shortcuts">
      <Link to="/staff/key-requests"><strong>จัดการการเบิกกุญแจ</strong><small>ตรวจสอบผู้ถือและสถานะคืน</small></Link>
      <Link to="/staff/meeting-rooms"><strong>จัดการห้องประชุม</strong><small>ติดตามรายการจองจากระบบจริง</small></Link>
      <Link to="/staff/reports/labs"><strong>รายงานและ Export</strong><small>กรองข้อมูลและบันทึกเป็น PDF</small></Link>
    </div>
    {(rooms.error || bookings.error || keys.error) && <div className="staff-section"><BackendLimitation title="ข้อมูลบางส่วนยังไม่พร้อม">ระบบไม่สามารถอ่านข้อมูลภาพรวมบางชุดได้ในขณะนี้ กรุณาเปิดหน้ารายการเพื่อลองอีกครั้ง</BackendLimitation></div>}
  </StaffPage>
}

export function StaffRoomsPage() {
  const rooms = useQuery(roomsQuery())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RoomStatusFilter>('all')
  const filtered = useMemo(() => filterRooms(rooms.data ?? [], search, status), [rooms.data, search, status])
  return <StaffPage eyebrow="Room Overview" title="ข้อมูลห้อง" description="ค้นหาและตรวจสอบสถานะห้องจากฐานข้อมูลปัจจุบัน">
    <div className="staff-toolbar"><div className="staff-field grow"><label htmlFor="room-search">ค้นหาห้อง</label><input id="room-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="รหัส ชื่อ อาคาร หรือชั้น" /></div><div className="staff-field"><label htmlFor="room-status">สถานะ</label><select id="room-status" value={status} onChange={(event) => setStatus(event.target.value as RoomStatusFilter)}><option value="all">ทั้งหมด</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div></div>
    <StaffQueryState loading={rooms.isPending} error={rooms.error} empty={!filtered.length} emptyText="ไม่พบห้องที่ตรงกับคำค้นหรือสถานะ">
      <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ห้อง</th><th>ประเภท</th><th>สถานที่</th><th>ความจุ</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>{filtered.map((room) => <tr key={room.id}><td><strong>{room.code}</strong><small>{room.name}</small></td><td>{isMeetingRoom(room) ? 'ห้องประชุม' : 'ห้องปฏิบัติการ'}</td><td>{room.building ?? '—'}<small>ชั้น {room.floor ?? '—'}</small></td><td>{room.capacity} คน</td><td><StatusBadge status={room.active ? 'ACTIVE' : 'INACTIVE'} /></td><td><Link to={`/staff/rooms/${room.id}`}>ดูรายละเอียด</Link></td></tr>)}</tbody></table></div>
    </StaffQueryState>
  </StaffPage>
}

export function StaffRoomDetailPage() {
  const { roomId = '' } = useParams()
  const room = useQuery(roomQuery(roomId))
  return <StaffPage eyebrow="Room Detail" title={room.data?.name ?? 'รายละเอียดห้อง'} description="ข้อมูลห้องและความพร้อมใช้งานจากระบบปัจจุบัน" actions={<Link className="staff-button secondary" to="/staff/rooms">กลับไปข้อมูลห้อง</Link>}>
    <StaffQueryState loading={room.isPending} error={room.error} empty={!room.data}>
      {room.data && <><article className="staff-card"><div className="staff-section-head"><h3>{room.data.code} · {room.data.name}</h3><StatusBadge status={room.data.active ? 'ACTIVE' : 'INACTIVE'} /></div><dl className="staff-detail-list"><div><dt>ประเภท</dt><dd>{isMeetingRoom(room.data) ? 'ห้องประชุม' : 'ห้องปฏิบัติการ'}</dd></div><div><dt>ความจุ</dt><dd>{room.data.capacity} คน</dd></div><div><dt>อาคาร</dt><dd>{room.data.building ?? 'ไม่ระบุ'}</dd></div><div><dt>ชั้น</dt><dd>{room.data.floor ?? 'ไม่ระบุ'}</dd></div><div><dt>เปิดให้จอง</dt><dd>{room.data.booking_enabled ? 'เปิด' : 'ปิด'}</dd></div><div><dt>ตำแหน่ง</dt><dd>{room.data.location_description ?? 'ไม่ระบุ'}</dd></div></dl>{room.data.description && <p>{room.data.description}</p>}</article><div className="staff-section"><BackendLimitation title="ข้อมูลอุปกรณ์และรายการใช้งาน">Schema ที่ Frontend ใช้อยู่ยังไม่มี relation อุปกรณ์ใน room service และหน้านี้ไม่เพิ่ม query ที่อาจข้ามสิทธิ์ รายการใช้งานดูได้จากหน้าประวัติและรายงาน</BackendLimitation></div></>}
    </StaffQueryState>
  </StaffPage>
}

export function StaffSettingsPage() {
  return <StaffPage eyebrow="System Settings" title="ตั้งค่าระบบ" description="รวมจุดตั้งค่าที่ Backend ปัจจุบันรองรับจริง">
    <div className="staff-grid staff-grid-3"><article className="staff-card"><h3>นโยบายการใช้งานห้อง</h3><p>ระบบเดิมมีหน้ากำหนดสิทธิ์ห้องผ่าน authorized RPC</p><Link className="staff-button secondary" to="/admin/policies">เปิดการตั้งค่าเดิม</Link></article><article className="staff-card"><h3>ภาคการศึกษา</h3><p>จัดการภาคเรียนผ่านหน้าผู้ดูแลเดิม</p><Link className="staff-button secondary" to="/admin/terms">เปิดการตั้งค่าเดิม</Link></article><article className="staff-card"><h3>ตารางเรียน</h3><p>จัดการตารางการใช้ห้องผ่าน workflow เดิม</p><Link className="staff-button secondary" to="/admin/academic-schedules">เปิดการตั้งค่าเดิม</Link></article></div>
    <div className="staff-section"><BackendLimitation title="ไม่มีการตั้งค่าความปลอดภัยใหม่">หน้านี้ไม่เปลี่ยน Role, Permission, RLS หรือ Business Rules และจะแสดงเฉพาะการตั้งค่าที่ระบบเดิมรองรับ</BackendLimitation></div>
  </StaffPage>
}
