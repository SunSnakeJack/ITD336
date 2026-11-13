import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { adminBookingsQuery } from '../../bookings/booking.queries'
import { activeKeyLoansQuery } from '../../keys/key.queries'
import { getBorrowerIdentity } from '../../keys/utils/admin-key.utils'
import { roomsQuery } from '../../rooms/room.queries'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { StaffAddUserDialog } from '../components/StaffAddUserDialog'
import { BackendLimitation, StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { StaffRoleDialog } from '../components/StaffRoleDialog'
import { inviteStaffUser, setStaffUserRoles, setStaffUserStatus } from '../staff-user.service'
import { staffRoleOptionsQuery, staffUserDirectoryQuery, staffUserKeys } from '../staff-user.queries'
import type { StaffUserDirectoryItem } from '../types/staff-user.types'
import { bangkokDateTime, isMeetingRoom } from '../utils/staff-analytics'
import './StaffUserManagement.css'

export function StaffUsersPage() {
  const query=useQuery(staffUserDirectoryQuery());const roles=useQuery(staffRoleOptionsQuery());const client=useQueryClient();const[editing,setEditing]=useState<StaffUserDirectoryItem|null>(null);const[adding,setAdding]=useState(false);const[statusAction,setStatusAction]=useState<{user:StaffUserDirectoryItem;status:StaffUserDirectoryItem['accountStatus']}|null>(null)
  const save=useMutation({mutationFn:setStaffUserRoles,onSuccess:async()=>{await client.invalidateQueries({queryKey:staffUserKeys.directory});setEditing(null)}})
  const invite=useMutation({mutationFn:inviteStaffUser,onSuccess:async()=>{await client.invalidateQueries({queryKey:staffUserKeys.directory});setAdding(false)}})
  const status=useMutation({mutationFn:setStaffUserStatus,onSuccess:async()=>{await client.invalidateQueries({queryKey:staffUserKeys.directory});setStatusAction(null)}})
  const PencilIcon=()=> <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></svg>
  const EraserIcon=()=> <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 20-4-4L14 5l5 5-10 10H7Z"/><path d="m11 8 5 5"/><path d="M7 20h13"/></svg>
  return <StaffPage eyebrow="User Management" title="จัดการผู้ใช้งาน" description="รายชื่อผู้ใช้และบทบาททั้งหมดที่บัญชีได้รับ" actions={<button className="staff-button" type="button" onClick={()=>{invite.reset();setAdding(true)}}>เพิ่มสมาชิกใหม่</button>}><StaffQueryState loading={query.isPending||roles.isPending} error={query.error||roles.error} empty={!query.data?.length} emptyText="ยังไม่มีผู้ใช้งานในระบบ"><div className="staff-table-wrap"><table className="staff-table staff-user-table"><thead><tr><th>ชื่อ–นามสกุล</th><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{query.data?.map((user)=><tr key={user.id}><td><strong>{user.fullName||'ยังไม่มีชื่อ'}</strong></td><td>{user.email}</td><td><div className="staff-role-list">{user.roleCodes.length?user.roleCodes.map((code,index)=><span className="staff-role-badge" key={code}>{user.roleNames[index]||code}</span>):<span className="staff-role-empty">ยังไม่ได้กำหนด</span>}</div></td><td><StatusBadge status={user.accountStatus}/></td><td><div className="staff-user-actions"><button type="button" aria-label={`แก้ไขบทบาท ${user.fullName}`} title="แก้ไขบทบาท" onClick={()=>{save.reset();setEditing(user)}}><PencilIcon/></button>{user.accountStatus==='ACTIVE'?<><button className="suspend" type="button" aria-label={`ระงับบัญชี ${user.fullName}`} title="ระงับบัญชี" onClick={()=>setStatusAction({user,status:'SUSPENDED'})}>Ⅱ</button><button className="inactive" type="button" aria-label={`ปิดใช้งานบัญชี ${user.fullName}`} title="ปิดใช้งานบัญชี" onClick={()=>setStatusAction({user,status:'INACTIVE'})}><EraserIcon/></button></>:<button className="activate" type="button" aria-label={`เปิดใช้งานบัญชี ${user.fullName}`} onClick={()=>setStatusAction({user,status:'ACTIVE'})}>เปิดใช้งาน</button>}</div></td></tr>)}</tbody></table></div></StaffQueryState>{editing&&<StaffRoleDialog user={editing} roles={roles.data??[]} pending={save.isPending} error={save.error?.message} onClose={()=>setEditing(null)} onSave={(input)=>save.mutate({userId:editing.id,roleCodes:input.roleCodes})}/>} {adding&&<StaffAddUserDialog roles={roles.data??[]} pending={invite.isPending} error={invite.error?.message} onClose={()=>setAdding(false)} onSave={(input)=>invite.mutate(input)}/>} {statusAction&&<ConfirmDialog title={statusAction.status==='ACTIVE'?'เปิดใช้งานบัญชี':statusAction.status==='SUSPENDED'?'ระงับบัญชี':'ปิดใช้งานบัญชี'} message={`${statusAction.user.fullName} จะ${statusAction.status==='ACTIVE'?'กลับเข้าสู่ระบบได้ตามปกติ':statusAction.status==='SUSPENDED'?'ถูกระงับและออกจากระบบ':'ไม่สามารถเข้าสู่ระบบ แต่ประวัติจะยังคงอยู่'}`} confirmLabel="ยืนยัน" danger={statusAction.status!=='ACTIVE'} pending={status.isPending} onClose={()=>setStatusAction(null)} onConfirm={()=>status.mutate({userId:statusAction.user.id,status:statusAction.status})}/>}</StaffPage>
}

export function StaffUserFormPage() {
  const { userId } = useParams()
  return <StaffPage eyebrow="User Form" title={userId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} description="แบบฟอร์มถูกปิดไว้จนกว่า Backend จะรองรับการจัดการบัญชีอย่างปลอดภัย" actions={<Link className="staff-button secondary" to="/staff/users">กลับไปรายการผู้ใช้</Link>}>
    <BackendLimitation title="ยังไม่เปิดให้บันทึกข้อมูล">การสร้างบัญชี แก้สถานะ หรือกำหนด role เป็น operation ที่มีผลด้านความปลอดภัย ระบบปัจจุบันไม่มี ADMIN-authorized RPC สำหรับงานนี้</BackendLimitation>
    <div className="staff-section staff-card"><div className="staff-field"><label>ชื่อผู้ใช้งาน</label><input disabled placeholder="รอ Backend รองรับ" /></div><div className="staff-field staff-section"><label>บทบาท</label><select disabled><option>ไม่สามารถกำหนดได้</option></select></div><button className="staff-button staff-section" disabled>บันทึกข้อมูล</button></div>
  </StaffPage>
}

export function StaffKeyRequestsPage() {
  const query = useQuery(activeKeyLoansQuery())
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const rows = useMemo(() => (query.data ?? []).filter((loan) => {
    const borrower = getBorrowerIdentity(loan)
    const text = `${borrower.name} ${borrower.identifier} ${loan.roomCode} ${loan.roomName}`.toLocaleLowerCase('th')
    return text.includes(search.trim().toLocaleLowerCase('th')) && (status === 'all' || loan.status === status)
  }), [query.data, search, status])
  return <StaffPage eyebrow="Key Requests" title="จัดการการเบิกกุญแจ" description="รายการสถานะกุญแจที่ผู้ดูแลมีสิทธิ์เข้าถึงจาก admin view">
    <div className="staff-toolbar"><div className="staff-field grow"><label htmlFor="key-search">ค้นหาคำขอ</label><input id="key-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ชื่อ รหัส หรือห้อง" /></div><div className="staff-field"><label htmlFor="key-status">สถานะ</label><select id="key-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">ทั้งหมด</option><option value="REQUESTED">รอดำเนินการ</option><option value="APPROVED">อนุมัติแล้ว</option><option value="CHECKED_OUT">กำลังถือ</option><option value="RETURN_REPORTED">รอตรวจรับ</option><option value="LATE">เกินกำหนด</option></select></div></div>
    <StaffQueryState loading={query.isPending} error={query.error} empty={!rows.length}><div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>ผู้ขอ</th><th>ห้อง</th><th>วันที่ขอ</th><th>แหล่งสิทธิ์</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>{rows.map((loan) => { const borrower = getBorrowerIdentity(loan); return <tr key={loan.id}><td><strong>{borrower.name}</strong><small>{borrower.identifier}</small></td><td><strong>{loan.roomCode}</strong><small>{loan.roomName}</small></td><td>{bangkokDateTime.format(new Date(loan.requested_at))}</td><td>{loan.usage_source === 'CLASS_SCHEDULE' ? 'ตารางเรียน' : loan.usage_source === 'BOOKING' ? 'การจอง' : 'ใช้ห้องโดยตรง'}</td><td><StatusBadge status={loan.status} /></td><td><Link to={`/staff/key-requests/${loan.id}`}>เปิดรายการ</Link></td></tr> })}</tbody></table></div></StaffQueryState>
  </StaffPage>
}

export function StaffKeyRequestDetailPage() {
  const { requestId = '' } = useParams()
  const query = useQuery(activeKeyLoansQuery())
  const loan = query.data?.find((item) => item.id === requestId)
  const borrower = loan ? getBorrowerIdentity(loan) : null
  return <StaffPage eyebrow="Key Request Detail" title="รายละเอียดคำขอเบิกกุญแจ" description="ข้อมูล lifecycle ที่ Backend เปิดให้ผู้ดูแลเข้าถึง" actions={<Link className="staff-button secondary" to="/staff/key-requests">กลับไปรายการ</Link>}>
    <StaffQueryState loading={query.isPending} error={query.error} empty={!loan} emptyText="ไม่พบรายการนี้ หรือรายการปิดแล้วและไม่อยู่ใน admin activity view">
      {loan && borrower && <><article className="staff-card"><div className="staff-section-head"><h3>{loan.roomCode} · {loan.roomName}</h3><StatusBadge status={loan.status} /></div><dl className="staff-detail-list"><div><dt>ผู้ขอ</dt><dd>{borrower.name}</dd></div><div><dt>รหัส/อีเมล</dt><dd>{borrower.identifier}</dd></div><div><dt>วันที่ส่งคำขอ</dt><dd>{bangkokDateTime.format(new Date(loan.requested_at))}</dd></div><div><dt>กำหนดคืน</dt><dd>{loan.expected_return_at ? bangkokDateTime.format(new Date(loan.expected_return_at)) : 'ยังไม่กำหนด'}</dd></div><div><dt>รหัสกุญแจ</dt><dd>{loan.keyCode ?? 'ยังไม่ได้จ่ายกุญแจ'}</dd></div><div><dt>คืนจริง</dt><dd>{loan.returned_at ? bangkokDateTime.format(new Date(loan.returned_at)) : 'ยังไม่คืน'}</dd></div></dl></article><div className="staff-section"><BackendLimitation title="การอนุมัติใช้ workflow เดิม">หน้านี้ไม่เพิ่ม state transition ใหม่ การอนุมัติ/ปฏิเสธและตรวจรับยังดำเนินการผ่าน authorized RPC และหน้า Admin เดิมเพื่อไม่ขัดกับ Business Rules</BackendLimitation></div></>}
    </StaffQueryState>
  </StaffPage>
}

export function StaffMeetingRoomsPage() {
  const rooms = useQuery(roomsQuery())
  const bookings = useQuery(adminBookingsQuery())
  const [search, setSearch] = useState('')
  const meetingRooms = (rooms.data ?? []).filter(isMeetingRoom).filter((room) => `${room.code} ${room.name}`.toLocaleLowerCase('th').includes(search.toLocaleLowerCase('th')))
  const meetingCodes = new Set(meetingRooms.map((room) => room.code))
  const upcoming = (bookings.data ?? []).filter((booking) => meetingCodes.has(booking.roomCode) && new Date(booking.endsAt).getTime() >= Date.now())
  return <StaffPage eyebrow="Meeting Rooms" title="จัดการห้องประชุม" description="ข้อมูลห้องและรายการจองจากระบบจริง" actions={<Link className="staff-button" to="/staff/meeting-rooms/new">เพิ่มห้องประชุม</Link>}>
    <div className="staff-toolbar"><div className="staff-field grow"><label htmlFor="meeting-search">ค้นหาห้องประชุม</label><input id="meeting-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="รหัสหรือชื่อห้อง" /></div></div>
    <StaffQueryState loading={rooms.isPending || bookings.isPending} error={rooms.error || bookings.error} empty={!meetingRooms.length}><div className="staff-grid staff-grid-3">{meetingRooms.map((room) => <article className="staff-card" key={room.id}><div className="staff-section-head"><h3>{room.code}</h3><StatusBadge status={room.active ? 'ACTIVE' : 'INACTIVE'} /></div><p>{room.name}</p><small>ความจุ {room.capacity} คน · รายการล่วงหน้า {upcoming.filter((item) => item.roomCode === room.code).length}</small><p><Link to={`/staff/rooms/${room.id}`}>ดูรายละเอียด</Link> · <Link to={`/staff/meeting-rooms/${room.id}/edit`}>แก้ไข</Link></p></article>)}</div></StaffQueryState>
  </StaffPage>
}

export function StaffMeetingRoomFormPage() {
  const { roomId } = useParams()
  return <StaffPage eyebrow="Meeting Room Form" title={roomId ? 'แก้ไขห้องประชุม' : 'เพิ่มห้องประชุม'} description="การเปลี่ยนข้อมูลห้องต้องผ่าน Backend authorization" actions={<Link className="staff-button secondary" to="/staff/meeting-rooms">กลับไปรายการ</Link>}>
    <BackendLimitation title="Blocked by Backend CRUD">room service ปัจจุบันรองรับการอ่านข้อมูลเท่านั้น ไม่มี authorized RPC สำหรับสร้างหรือแก้ไขห้อง จึงปิดการบันทึกเพื่อไม่ bypass RLS หรือ Business Rules</BackendLimitation>
    <div className="staff-section staff-card"><div className="staff-detail-list"><div className="staff-field"><label>ชื่อห้อง</label><input disabled /></div><div className="staff-field"><label>ความจุ</label><input disabled type="number" /></div><div className="staff-field"><label>อาคาร</label><input disabled /></div><div className="staff-field"><label>ชั้น</label><input disabled /></div></div><button className="staff-button staff-section" disabled>บันทึกข้อมูล</button></div>
  </StaffPage>
}
