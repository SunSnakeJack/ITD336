import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { SelectField } from '../../../shared/components/SelectField'
import { roomEditorOptionsQuery, roomKeys, roomsQuery } from '../../rooms/room.queries'
import { setAdminRoomActive } from '../../rooms/room.service'
import type { Room } from '../../rooms/room.types'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { filterAndSortRooms, type RoomCategoryFilter, type RoomSort, type RoomStatusFilter } from '../utils/staff-analytics'
import './StaffRoomManagement.css'
import { thaiRoomType } from '../../rooms/utils/room-type-label'

const PAGE_SIZE=10
const Icon=({type}:{type:'view'|'edit'|'delete'})=><svg aria-hidden="true" viewBox="0 0 24 24">{type==='view'&&<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>}{type==='edit'&&<><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>}{type==='delete'&&<><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></>}</svg>

export function StaffRoomsPage(){
 const rooms=useQuery(roomsQuery());const options=useQuery(roomEditorOptionsQuery());const client=useQueryClient()
 const[search,setSearch]=useState('');const[status,setStatus]=useState<RoomStatusFilter>('all');const[category,setCategory]=useState<RoomCategoryFilter>('all');const[sort,setSort]=useState<RoomSort>('code');const[page,setPage]=useState(1);const[deleting,setDeleting]=useState<Room|null>(null)
 const typeNames=useMemo(()=>new Map((options.data?.roomTypes??[]).map(item=>[item.id,thaiRoomType(item.code||item.name)])),[options.data]);const typeLabel=useCallback((room:Room)=>typeNames.get(room.room_type_id)??'ไม่ระบุประเภท',[typeNames])
 const filtered=useMemo(()=>filterAndSortRooms(rooms.data??[],{search,status,category,sort,typeLabel}),[rooms.data,search,status,category,sort,typeLabel])
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const safePage=Math.min(page,pageCount);const visible=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE)
 useEffect(()=>setPage(1),[search,status,category,sort])
 const deactivate=useMutation({mutationFn:setAdminRoomActive,onSuccess:async()=>{await client.invalidateQueries({queryKey:roomKeys.all});setDeleting(null)}})
 return <StaffPage eyebrow="Room Overview" title="จัดการข้อมูลห้อง" description="ค้นหา กรอง และจัดการสถานะห้องจากข้อมูลจริง" actions={<Link className="staff-button" to="/staff/rooms/new">เพิ่มห้องใหม่</Link>}>
  <div className="staff-room-toolbar"><label className="staff-room-search">ค้นหาห้อง<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่อห้อง"/></label><SelectField label="ประเภทห้อง" value={category} placeholder="ทุกประเภท" options={[{value:'all',label:'ทุกประเภท'},{value:'general',label:'ห้องทั่วไป'},{value:'special',label:'ห้องพิเศษ'},{value:'meeting',label:'ห้องประชุม'}]} onChange={setCategory}/><SelectField label="สถานะ" value={status} placeholder="ทุกสถานะ" options={[{value:'all',label:'ทุกสถานะ'},{value:'active',label:'เปิดใช้งาน'},{value:'inactive',label:'ปิดใช้งาน'}]} onChange={setStatus}/><SelectField label="เรียงตาม" value={sort} placeholder="รหัสห้อง" options={[{value:'code',label:'รหัสห้อง'},{value:'type',label:'ประเภท'},{value:'capacity',label:'ความจุ'},{value:'status',label:'สถานะ'}]} onChange={setSort}/></div>
  <StaffQueryState loading={rooms.isPending||options.isPending} error={rooms.error||options.error} empty={!filtered.length} emptyText="ไม่พบห้องที่ตรงกับตัวกรอง"><div className="staff-table-wrap"><table className="staff-table staff-room-table"><thead><tr><th>ห้อง</th><th>ประเภท</th><th>ความจุ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visible.map(room=><tr key={room.id}><td><strong>{room.code}</strong><small>{room.name}</small></td><td>{typeLabel(room)}</td><td>{room.capacity} คน</td><td><StatusBadge status={room.active?'ACTIVE':'INACTIVE'}/></td><td><div className="staff-room-actions"><Link aria-label={`ดู ${room.code}`} title="ดูรายละเอียด" to={`/staff/rooms/${room.id}`}><Icon type="view"/></Link><Link aria-label={`แก้ไข ${room.code}`} title="แก้ไข" to={`/staff/rooms/${room.id}/edit`}><Icon type="edit"/></Link><button type="button" aria-label={`ลบ ${room.code}`} title={room.active?'ปิดใช้งานห้อง':'ห้องถูกปิดใช้งานแล้ว'} disabled={!room.active} onClick={()=>setDeleting(room)}><Icon type="delete"/></button></div></td></tr>)}</tbody></table></div><nav className="staff-pagination" aria-label="หน้ารายการห้อง"><span>แสดง {filtered.length?(safePage-1)*PAGE_SIZE+1:0}–{Math.min(safePage*PAGE_SIZE,filtered.length)} จาก {filtered.length}</span><div><button type="button" disabled={safePage===1} onClick={()=>setPage(value=>value-1)}>ก่อนหน้า</button><b>หน้า {safePage} / {pageCount}</b><button type="button" disabled={safePage===pageCount} onClick={()=>setPage(value=>value+1)}>ถัดไป</button></div></nav></StaffQueryState>
  {deleting&&<ConfirmDialog title="ยืนยันการปิดใช้งานห้อง" message={`${deleting.code} จะไม่แสดงเป็นห้องที่เปิดใช้งาน แต่ข้อมูลและประวัติทั้งหมดจะยังคงอยู่`} confirmLabel="ปิดใช้งานห้อง" danger pending={deactivate.isPending} onClose={()=>setDeleting(null)} onConfirm={()=>deactivate.mutate({roomId:deleting.id,active:false})}/>} {deactivate.error&&<p className="staff-role-error" role="alert">{deactivate.error.message}</p>}
 </StaffPage>
}
