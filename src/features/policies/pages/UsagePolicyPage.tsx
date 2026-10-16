import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner'
import { roomsQuery } from '../../schedules/schedule.queries'
import { policyKeys, roomUsagePolicyQuery } from '../policy.queries'
import { saveRoomUsagePolicy } from '../policy.service'
import type { RoomUsagePolicy } from '../policy.types'

type PolicyKey=Exclude<keyof RoomUsagePolicy,'roomId'>
const rows:{label:string;guest?:PolicyKey;student?:PolicyKey;guestFixed?:boolean;studentFixed?:boolean;note?:string}[]=[
 {label:'ดูรายละเอียดห้อง',guest:'guestViewDetails',student:'studentViewDetails'},
 {label:'ดูตารางห้องและตารางว่าง',guest:'guestViewSchedule',student:'studentViewSchedule'},
 {label:'จองห้องเมื่อไม่มีคาบเรียน',guestFixed:false,student:'studentBookEmpty'},
 {label:'จองห้องเมื่อมีคาบเรียน',guestFixed:false,studentFixed:false,note:'ช่วงเวลาที่มีคาบเรียนถูกสงวนไว้'},
 {label:'เบิกกุญแจเมื่อมีคาบเรียน',guestFixed:false,student:'studentClassKey'},
 {label:'เบิกกุญแจจากการจองของตน',guestFixed:false,student:'studentOwnBookingKey'},
 {label:'เบิกกุญแจจากการจองของผู้อื่น',guestFixed:false,studentFixed:false,note:'ปิดถาวรเพื่อป้องกันการใช้สิทธิ์แทนผู้อื่น'},
 {label:'แก้ไขหรือยกเลิกการจองของตน',guestFixed:false,student:'studentManageOwnBooking'},
 {label:'ดูสถานะกุญแจของตน',guestFixed:false,student:'studentViewOwnKeyStatus'},
 {label:'ดูประวัติการใช้งานของตน',guestFixed:false,student:'studentViewOwnHistory'},
]

function MatrixToggle({value,onChange,label,locked=false}:{value:boolean;onChange?:()=>void;label:string;locked?:boolean}){return <button aria-label={label} className={`matrix-toggle ${value?'enabled':'disabled'}`} disabled={locked} onClick={onChange} type="button">{value?'✓':'—'}</button>}
function PolicyEditor({roomId}:{roomId:string}){const query=useQuery(roomUsagePolicyQuery(roomId));const client=useQueryClient();const [draft,setDraft]=useState<RoomUsagePolicy|null>(null);const policy=draft??query.data??null;const save=useMutation({mutationFn:saveRoomUsagePolicy,onSuccess:()=>{setDraft(null);return client.invalidateQueries({queryKey:policyKeys.room(roomId)})}});if(query.isPending||!policy)return <LoadingSpinner label="กำลังโหลดกฎของห้อง…"/>;const change=(key:PolicyKey)=>setDraft({...policy,[key]:!policy[key]});return <div className="permission-matrix-wrap"><table className="permission-matrix"><thead><tr><th>ฟังก์ชัน / สถานการณ์</th><th>Guest</th><th>Student</th></tr></thead><tbody>{rows.map((row)=><tr key={row.label}><td><strong>{row.label}</strong>{row.note&&<small>{row.note}</small>}</td><td>{row.guest?<MatrixToggle label={`Guest ${row.label}`} value={Boolean(policy[row.guest])} onChange={()=>change(row.guest as PolicyKey)}/>:<MatrixToggle label={`Guest ${row.label} ไม่สามารถแก้ไขได้`} value={Boolean(row.guestFixed)} locked/>}</td><td>{row.student?<MatrixToggle label={`Student ${row.label}`} value={Boolean(policy[row.student])} onChange={()=>change(row.student as PolicyKey)}/>:<MatrixToggle label={`Student ${row.label} ไม่สามารถแก้ไขได้`} value={Boolean(row.studentFixed)} locked/>}</td></tr>)}</tbody></table><label className="approval-policy"><span><strong>รายการจองต้องรอ Admin อนุมัติ</strong><small>ใช้กับการจองใหม่ของ Student ในห้องนี้</small></span><input checked={policy.manualApproval} onChange={()=>change('manualApproval')} type="checkbox"/></label><footer><button className="primary-action" disabled={save.isPending||!draft} onClick={()=>save.mutate(policy)}>{save.isPending?'กำลังบันทึก…':'บันทึกการตั้งค่าห้อง'}</button>{save.isSuccess&&<span>บันทึกแล้ว</span>}{save.error&&<span className="panel-error">{save.error.message}</span>}</footer></div>}

export function UsagePolicyPage(){const rooms=useQuery(roomsQuery());const [roomId,setRoomId]=useState('');const selected=roomId||rooms.data?.[0]?.id||'';return <section className="content-page policy-page"><div className="page-heading"><div><span>ROOM PERMISSIONS</span><h1>กำหนดสิทธิ์รายห้อง</h1><p>ตั้งค่าการมองเห็น การจอง และการเบิกกุญแจสำหรับ Guest และ Student</p></div></div>{rooms.isPending?<LoadingSpinner label="กำลังโหลดห้อง…"/>:rooms.error?<p className="panel-error">{rooms.error.message}</p>:<><label className="policy-room-picker">ห้อง<select value={selected} onChange={(event)=>setRoomId(event.target.value)}>{rooms.data?.map((room)=><option key={room.id} value={room.id}>{room.code} · {room.name}</option>)}</select></label>{selected&&<PolicyEditor key={selected} roomId={selected}/>}</>}</section>}
