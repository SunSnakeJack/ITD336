import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { SelectField } from '../../../shared/components/SelectField'
import { StaffAddUserDialog } from '../components/StaffAddUserDialog'
import { StaffPage, StaffQueryState, StatusBadge } from '../components/StaffPage'
import { StaffRoleDialog } from '../components/StaffRoleDialog'
import { staffRoleOptionsQuery, staffUserDirectoryQuery, staffUserKeys } from '../staff-user.queries'
import { inviteStaffUser, setStaffUserRoles, setStaffUserStatus, updateStaffUserProfile } from '../staff-user.service'
import type { StaffUserDirectoryItem } from '../types/staff-user.types'
import { filterUserDirectory, userDirectoryStats } from '../utils/staff-user-directory'
import './StaffUserManagement.css'

const PAGE_SIZE = 10
const initials = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toLocaleUpperCase('th') || 'U'
const Icon = ({ type }: { type: 'edit' | 'pause' | 'disable' }) => <svg aria-hidden="true" viewBox="0 0 24 24">
  {type === 'edit' && <><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>}
  {type === 'pause' && <><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></>}
  {type === 'disable' && <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-6 6-6 1.5 0 2.7.3 3.7 1"/><path d="m15 16 6 6m0-6-6 6"/></>}
</svg>

export function StaffUsersPage() {
  const query = useQuery(staffUserDirectoryQuery())
  const roles = useQuery(staffRoleOptionsQuery())
  const client = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('ALL')
  const [accountStatus, setAccountStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<StaffUserDirectoryItem | null>(null)
  const adding = searchParams.get('dialog') === 'add'
  const [statusAction, setStatusAction] = useState<{ user: StaffUserDirectoryItem; status: StaffUserDirectoryItem['accountStatus'] } | null>(null)
  const [statusNotice, setStatusNotice] = useState('')
  const users = useMemo(() => query.data ?? [], [query.data])
  const stats = useMemo(() => userDirectoryStats(users), [users])
  const filtered = useMemo(() => filterUserDirectory(users, { search, role, status: accountStatus }), [users, search, role, accountStatus])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search, role, accountStatus])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const refresh = () => client.invalidateQueries({ queryKey: staffUserKeys.directory })
  const save = useMutation({
    mutationFn: async (input: { firstName:string;lastName:string;roleCodes: string[]; accountStatus: StaffUserDirectoryItem['accountStatus'] }) => {
      if (!editing) return
      if(input.firstName!==editing.firstName||input.lastName!==editing.lastName)await updateStaffUserProfile({userId:editing.id,firstName:input.firstName,lastName:input.lastName})
      await setStaffUserRoles({ userId: editing.id, roleCodes: input.roleCodes })
      if (input.accountStatus !== editing.accountStatus) await setStaffUserStatus({ userId: editing.id, status: input.accountStatus })
    },
    onSuccess: async () => { await refresh(); setStatusNotice('บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว'); setEditing(null) },
  })
  const closeAdd=()=>setSearchParams({}, { replace:true })
  const invite = useMutation({ mutationFn: inviteStaffUser, onSuccess: async () => { await refresh(); closeAdd() } })
  const status = useMutation({ mutationFn: setStaffUserStatus, onSuccess: async (_,input) => { await refresh(); setStatusNotice(input.status==='ACTIVE'?'เปิดใช้งานบัญชีเรียบร้อยแล้ว':input.status==='SUSPENDED'?'ระงับบัญชีเรียบร้อยแล้ว':'ปิดใช้งานบัญชีเรียบร้อยแล้ว'); setStatusAction(null) } })
  const openStatus = (user: StaffUserDirectoryItem, nextStatus: StaffUserDirectoryItem['accountStatus']) => setStatusAction({ user, status: nextStatus })

  return <StaffPage eyebrow="User Management" title="จัดการผู้ใช้งาน" description="จัดการบัญชี บทบาท และสถานะผู้ใช้" hideHeader>
    <div className="staff-user-stats" aria-label="สรุปผู้ใช้งาน"><article className="blue"><small>ผู้ใช้ทั้งหมด</small><strong>{stats.total}</strong><span>บัญชี</span></article><article className="teal"><small>เปิดใช้งาน</small><strong>{stats.active}</strong><span>บัญชี</span></article><article className="amber"><small>ระงับใช้งาน</small><strong>{stats.suspended}</strong><span>บัญชี</span></article></div>
    {statusNotice&&<p className="staff-success-notice" role="status">{statusNotice}</p>}
    <div className="staff-user-filters"><label className="grow">ค้นหาผู้ใช้<span className="staff-user-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรืออีเมล…" /></span></label><SelectField label="บทบาท" value={role} placeholder="ทุกบทบาท" options={[{value:'ALL',label:'ทุกบทบาท'},...(roles.data??[]).map(item=>({value:item.code,label:item.name}))]} onChange={setRole}/><SelectField label="สถานะ" value={accountStatus} placeholder="ทุกสถานะ" options={[{value:'ALL',label:'ทุกสถานะ'},{value:'ACTIVE',label:'เปิดใช้งาน'},{value:'SUSPENDED',label:'ระงับใช้งาน'},{value:'INACTIVE',label:'ปิดใช้งาน'}]} onChange={setAccountStatus}/></div>
    <StaffQueryState loading={query.isPending || roles.isPending} error={query.error || roles.error} empty={!users.length} emptyText="ยังไม่มีผู้ใช้งานในระบบ">
      {!pageRows.length ? <div className="staff-empty">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</div> : <section className="staff-user-panel"><header><strong>รายชื่อผู้ใช้งาน</strong><span>แสดง {filtered.length} รายการ</span></header><div className="staff-table-wrap"><table className="staff-table staff-user-table"><thead><tr><th>ชื่อ–นามสกุล / อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{pageRows.map((user) => <tr key={user.id}><td><div className="staff-user-identity"><span aria-hidden="true">{initials(user.fullName)}</span><div><strong>{user.fullName || 'ยังไม่มีชื่อ'}</strong><small>{user.email}</small></div></div></td><td><div className="staff-role-list">{user.roleCodes.length ? user.roleCodes.map((code, index) => <span className="staff-role-badge" key={code}>{user.roleNames[index] || code}</span>) : <span className="staff-role-empty">ยังไม่ได้กำหนด</span>}</div></td><td><StatusBadge status={user.accountStatus}/></td><td><div className="staff-user-actions"><button type="button" aria-label={`แก้ไขข้อมูล ${user.fullName}`} title="แก้ไขข้อมูล" onClick={() => { save.reset(); setEditing(user) }}><Icon type="edit"/></button>{user.accountStatus === 'ACTIVE' ? <><button className="suspend" type="button" aria-label={`ระงับบัญชี ${user.fullName}`} title="ระงับบัญชี" onClick={() => openStatus(user, 'SUSPENDED')}><Icon type="pause"/></button><button className="inactive" type="button" aria-label={`ปิดใช้งานบัญชี ${user.fullName}`} title="ปิดใช้งานบัญชี" onClick={() => openStatus(user, 'INACTIVE')}><Icon type="disable"/></button></> : <button className="activate" type="button" aria-label={`เปิดใช้งานบัญชี ${user.fullName}`} onClick={() => openStatus(user, 'ACTIVE')}>เปิดใช้งาน</button>}</div></td></tr>)}</tbody></table></div></section>}
      <nav className="staff-pagination" aria-label="หน้ารายชื่อผู้ใช้"><span>แสดง {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</button><b>หน้า {page} / {pageCount}</b><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>ถัดไป</button></div></nav>
    </StaffQueryState>
    {editing && <StaffRoleDialog user={editing} roles={roles.data ?? []} pending={save.isPending} error={save.error?.message} onClose={() => setEditing(null)} onSave={(input) => save.mutate(input)}/>} 
    {adding && <StaffAddUserDialog roles={roles.data ?? []} pending={invite.isPending} error={invite.error?.message} onClose={closeAdd} onSave={(input) => invite.mutate(input)}/>} 
    {statusAction && <ConfirmDialog title={statusAction.status === 'ACTIVE' ? 'เปิดใช้งานบัญชี' : statusAction.status === 'SUSPENDED' ? 'ระงับบัญชี' : 'ปิดใช้งานบัญชี'} message={`${statusAction.user.fullName} จะ${statusAction.status === 'ACTIVE' ? 'กลับเข้าสู่ระบบได้ตามปกติ' : statusAction.status === 'SUSPENDED' ? 'ถูกระงับและออกจากระบบ' : 'ไม่สามารถเข้าสู่ระบบ แต่ประวัติจะยังคงอยู่'}`} confirmLabel="ยืนยัน" danger={statusAction.status !== 'ACTIVE'} pending={status.isPending} error={status.error?.message} onClose={() => {status.reset();setStatusAction(null)}} onConfirm={() => status.mutate({ userId: statusAction.user.id, status: statusAction.status })}/>} 
  </StaffPage>
}
