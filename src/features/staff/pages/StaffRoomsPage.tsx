import { scheduleKeys } from '../../schedules/schedule.queries'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useOutletContext } from 'react-router-dom'
import { useTabDraft } from '../../../shared/components/useTabDraft'
import type { StaffOutletContext } from '../components/StaffLayout'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { SelectField } from '../../../shared/components/SelectField'
import { roomEditorOptionsQuery, roomEquipmentNamesQuery, roomKeys, roomsQuery } from '../../rooms/room.queries'
import { deleteAdminRoom } from '../../rooms/room.service'
import type { Room } from '../../rooms/room.types'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { filterAndSortRooms, roomCategory, type RoomCategoryFilter, type RoomStatusFilter } from '../utils/staff-analytics'
import { StaffRoomGridCard } from '../components/StaffRoomGridCard'
import './StaffRoomManagement.css'
import { thaiRoomType } from '../../rooms/utils/room-type-label'

const PAGE_SIZE=10
type RoomListState = { view: 'list' | 'grid'; search: string; status: RoomStatusFilter; category: RoomCategoryFilter; page: number }
const INITIAL_LIST: RoomListState = { view: 'grid', search: '', status: 'active', category: 'all', page: 1 }
const Icon=({type}:{type:'view'|'edit'|'delete'})=><svg aria-hidden="true" viewBox="0 0 24 24">{type==='view'&&<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>}{type==='edit'&&<><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>}{type==='delete'&&<><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7"/><path d="M10 11v5m4-5v5"/></>}</svg>

export function StaffRoomsPage(){
 const account = useOutletContext<StaffOutletContext | null>()
 const [{ view, search, status, category, page }, updateList] = useTabDraft(`staff-rooms:${account?.userId ?? ''}`, INITIAL_LIST)
 const setView = (view: RoomListState['view']) => updateList({ view })
 const setSearch = (search: string) => updateList({ search, page: 1 })
 const setStatus = (status: RoomStatusFilter) => updateList({ status, page: 1 })
 const setCategory = (category: RoomCategoryFilter) => updateList({ category, page: 1 })
 const rooms=useQuery(roomsQuery());const options=useQuery(roomEditorOptionsQuery());const client=useQueryClient()
 const[deleting,setDeleting]=useState<Room|null>(null)
 const typeNames=useMemo(()=>new Map((options.data?.roomTypes??[]).map(item=>[item.id,thaiRoomType(item.code||item.name)])),[options.data]);const typeLabel=useCallback((room:Room)=>typeNames.get(room.room_type_id)??'ไม่ระบุประเภท',[typeNames])
 const filtered=useMemo(()=>filterAndSortRooms(rooms.data??[],{search,status,category,sort:'code',typeLabel}),[rooms.data,search,status,category,typeLabel])
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const safePage=Math.min(page,pageCount);const visible=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE)
 const setPage = (step: number) => updateList({ page: safePage + step })
 const equipment = useQuery(roomEquipmentNamesQuery(visible.map(room => room.id).sort(), view === 'grid'))
 const equipmentSummary = (id: string) => {
  if (equipment.isError) return 'โหลดข้อมูลไม่ได้'
  if (equipment.isPending) return 'กำลังโหลด…'
  return equipment.data?.[id]?.join(', ') || 'ไม่มีอุปกรณ์'
 }
 const remove=useMutation({mutationFn:deleteAdminRoom,onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:roomKeys.all}),client.invalidateQueries({queryKey:scheduleKeys.all})]);setDeleting(null)}})
 return <StaffPage eyebrow="ภาพรวมข้อมูลห้อง" title="จัดการข้อมูลห้อง" description="ค้นหา กรอง และจัดการสถานะห้องจากข้อมูลจริง" hideHeader>
  <div className="staff-room-stats">{[{label:'ห้องทั้งหมด',value:rooms.data?.length},{label:'เปิดใช้งาน',value:rooms.data?.filter(room=>room.active).length},{label:'แสดงบนหน้าเว็บ',value:rooms.data?.filter(room=>room.visible_on_web!==false).length},{label:'ห้องพิเศษ',value:rooms.data?.filter(room=>roomCategory(room, typeLabel(room)) === 'special').length}].map(item=><article key={item.label}><small>{item.label}</small><strong>{rooms.isPending?'—':item.value??'—'}</strong><span>ห้อง</span></article>)}</div>
  <div className="staff-room-toolbar"><label className="staff-room-search">ค้นหาห้อง<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่อห้อง"/></label><SelectField label="ประเภทห้อง" value={category} placeholder="ทุกประเภท" options={[{value:'all',label:'ทุกประเภท'},{value:'general',label:'ห้องทั่วไป'},{value:'special',label:'ห้องพิเศษ'},{value:'meeting',label:'ห้องประชุม'}]} onChange={setCategory}/><SelectField label="สถานะ" value={status} placeholder="ทุกสถานะ" options={[{value:'all',label:'ทุกสถานะ'},{value:'active',label:'เปิดใช้งาน'},{value:'inactive',label:'ปิดใช้งาน'}]} onChange={setStatus}/><div className="staff-room-view" role="group" aria-label="รูปแบบการแสดงห้อง"><button type="button" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><span aria-hidden="true">▦</span> กริด</button><button type="button" aria-pressed={view==='list'} onClick={()=>setView('list')}><span aria-hidden="true">☰</span> รายการ</button></div></div>
  <StaffQueryState loading={rooms.isPending||options.isPending} error={rooms.error||options.error} empty={!filtered.length} emptyText="ไม่พบห้องที่ตรงกับตัวกรอง"><section className="staff-room-panel"><header><strong>รายการห้องทั้งหมด</strong><span>{filtered.length} ห้อง</span></header>{view==='grid'&&<div className="staff-room-grid">{visible.map(room=><StaffRoomGridCard key={room.id} room={room} equipmentSummary={equipmentSummary(room.id)}/>)}</div>}<div className="staff-table-wrap" hidden={view==='grid'}><table className="staff-table staff-room-table"><thead><tr><th>ห้อง</th><th>ประเภท</th><th>ความจุ</th><th>แสดงบนหน้าเว็บ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{visible.map(room=><tr key={room.id}><td><strong>{room.code}</strong><small>{room.name}</small></td><td>{typeLabel(room)}</td><td>{room.capacity} คน</td><td>{room.visible_on_web!==false?'แสดง':'ซ่อน'}</td><td><StatusBadge status={room.active?'ACTIVE':'INACTIVE'}/></td><td><div className="staff-room-actions"><Link aria-label={`ดู ${room.code}`} title="ดูรายละเอียด" to={`/staff/rooms/${room.id}`}><Icon type="view"/></Link><Link aria-label={`แก้ไข ${room.code}`} title="แก้ไข" to={`/staff/rooms/${room.id}/edit`}><Icon type="edit"/></Link><button type="button" aria-label={`ลบ ${room.code}`} title="ลบห้อง" onClick={()=>{remove.reset();setDeleting(room)}}><Icon type="delete"/></button></div></td></tr>)}</tbody></table></div><nav className="staff-pagination" aria-label="หน้ารายการห้อง"><span>แสดง {filtered.length?(safePage-1)*PAGE_SIZE+1:0}–{Math.min(safePage*PAGE_SIZE,filtered.length)} จาก {filtered.length}</span><div><button type="button" disabled={safePage===1} onClick={()=>setPage(-1)}>ก่อนหน้า</button><b>หน้า {safePage} / {pageCount}</b><button type="button" disabled={safePage===pageCount} onClick={()=>setPage(1)}>ถัดไป</button></div></nav></section></StaffQueryState>
  {deleting&&<ConfirmDialog title="ยืนยันการลบห้อง" message={`${deleting.code} · ${deleting.name} จะถูกลบออกจากระบบอย่างถาวร`} confirmLabel="ลบห้อง" danger error={remove.error?.message} pending={remove.isPending} onClose={()=>setDeleting(null)} onConfirm={()=>remove.mutate(deleting.id)}/>}
 </StaffPage>
}
