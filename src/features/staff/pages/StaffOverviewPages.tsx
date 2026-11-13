import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { keyCabinetRoomsQuery } from '../../keys/key.queries'
import { RoomEditorForm } from '../../rooms/components/RoomEditorForm'
import { adminRoomDetailQuery, roomEditorOptionsQuery, roomKeys, roomsQuery } from '../../rooms/room.queries'
import { saveAdminRoom } from '../../rooms/room.service'
import { BackendLimitation, StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { filterRooms, isMeetingRoom, type RoomStatusFilter } from '../utils/staff-analytics'
import './StaffRoomManagement.css'
import { keyRequestTimingSettingQuery } from '../staff-settings.queries'
import { StaffPermissionSettings } from '../components/StaffPermissionSettings'
import { thaiRoomType } from '../../rooms/utils/room-type-label'

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
  return <StaffPage eyebrow="Room Overview" title="ข้อมูลห้อง" description="ค้นหาและตรวจสอบสถานะห้องจากฐานข้อมูลปัจจุบัน" actions={<Link className="staff-button" to="/staff/rooms/new">เพิ่มห้องใหม่</Link>}>
    <div className="staff-toolbar"><div className="staff-field grow"><label htmlFor="room-search">ค้นหาห้อง</label><input id="room-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="รหัส ชื่อ อาคาร หรือชั้น" /></div><div className="staff-field"><label htmlFor="room-status">สถานะ</label><select id="room-status" value={status} onChange={(event) => setStatus(event.target.value as RoomStatusFilter)}><option value="all">ทั้งหมด</option><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></div></div>
    <StaffQueryState loading={rooms.isPending} error={rooms.error} empty={!filtered.length} emptyText="ไม่พบห้องที่ตรงกับคำค้นหรือสถานะ">
      <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ห้อง</th><th>ประเภท</th><th>ความจุ</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>{filtered.map((room) => <tr key={room.id}><td><strong>{room.code}</strong><small>{room.name}</small></td><td>{isMeetingRoom(room) ? 'ห้องประชุม' : 'ห้องปฏิบัติการ'}</td><td>{room.capacity} คน</td><td><StatusBadge status={room.active ? 'ACTIVE' : 'INACTIVE'} /></td><td><Link to={`/staff/rooms/${room.id}`}>ดูรายละเอียด</Link></td></tr>)}</tbody></table></div>
    </StaffQueryState>
  </StaffPage>
}

export function StaffRoomDetailPage() {
  const { roomId = '' } = useParams()
  const room = useQuery(adminRoomDetailQuery(roomId))
  return <StaffPage eyebrow="Room Detail" title={room.data?.name ?? 'รายละเอียดห้อง'} description="ข้อมูลห้องและความพร้อมใช้งานจากระบบปัจจุบัน" actions={<><Link className="staff-button secondary" to="/staff/rooms">กลับไปข้อมูลห้อง</Link><Link className="staff-button" to={`/staff/rooms/${roomId}/edit`}>แก้ไขข้อมูล</Link></>}>
    <StaffQueryState loading={room.isPending} error={room.error} empty={!room.data}>
      {room.data && <article className="staff-card staff-room-detail-card"><div className="staff-section-head"><h3>{room.data.code} · {room.data.name}</h3><StatusBadge status={room.data.active ? 'ACTIVE' : 'INACTIVE'} /></div><div className="staff-room-detail-layout">{room.data.image_url?<img src={room.data.image_url} alt={`รูปภาพ ${room.data.name}`}/>:<div className="staff-room-image-empty">ยังไม่มีรูปภาพห้อง</div>}<dl className="staff-detail-list"><div><dt>ประเภทห้อง</dt><dd>{thaiRoomType(room.data.room_type_name)}</dd></div><div><dt>ความจุ</dt><dd>{room.data.capacity} คน</dd></div><div><dt>เปิดให้จอง</dt><dd>{room.data.booking_enabled ? 'เปิด' : 'ปิด'}</dd></div><div><dt>เปิดใช้งานห้อง</dt><dd>{room.data.active ? 'เปิด' : 'ปิด'}</dd></div></dl></div>{room.data.description&&<p>{room.data.description}</p>}<section className="staff-room-equipment"><h3>อุปกรณ์เพิ่มเติม</h3>{room.data.equipment.length?<ul>{room.data.equipment.map(item=><li key={item.equipmentId}><strong>{item.name}</strong></li>)}</ul>:<p>ยังไม่มีข้อมูลอุปกรณ์เพิ่มเติม</p>}</section></article>}
    </StaffQueryState>
  </StaffPage>
}

export function StaffRoomFormPage(){
  const{roomId}=useParams();const navigate=useNavigate();const client=useQueryClient();const options=useQuery(roomEditorOptionsQuery());const room=useQuery(adminRoomDetailQuery(roomId??''));const save=useMutation({mutationFn:saveAdminRoom,onSuccess:async(id)=>{await client.invalidateQueries({queryKey:roomKeys.all});navigate(`/staff/rooms/${id}`)}})
  const editing=Boolean(roomId);const error=options.error||(editing?room.error:null)
  return <StaffPage eyebrow="Room Form" title={editing?'แก้ไขข้อมูลห้อง':'เพิ่มห้องใหม่'} description="ข้อมูลห้อง อุปกรณ์ และความพร้อมใช้งาน" actions={<Link className="staff-button secondary" to={editing?`/staff/rooms/${roomId}`:'/staff/rooms'}>ยกเลิก</Link>}><StaffQueryState loading={options.isPending||(editing&&room.isPending)} error={error} empty={!options.data}>{options.data&&<RoomEditorForm room={editing?room.data:undefined} options={options.data} pending={save.isPending} error={save.error?.message} onCancel={()=>navigate(editing?`/staff/rooms/${roomId}`:'/staff/rooms')} onSave={(input)=>save.mutate(input)}/>}</StaffQueryState></StaffPage>
}

export function StaffSettingsPage() {
  const setting=useQuery(keyRequestTimingSettingQuery())
  return <StaffPage eyebrow="Permission Settings" title="การตั้งค่าสิทธิ์" description="กำหนดข้อยกเว้นการใช้งานที่ควบคุมและบันทึกโดยระบบ"><StaffQueryState loading={setting.isPending} error={setting.error} empty={setting.data===undefined}>{setting.data!==undefined&&<StaffPermissionSettings key={String(setting.data)} initialValue={setting.data}/>}</StaffQueryState></StaffPage>
}
