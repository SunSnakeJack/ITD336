import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { StaffUserActionDialog } from '../components/StaffUserActionDialog'
import { SelectField } from '../../../shared/components/SelectField'
import { StaffAddUserDialog } from '../components/StaffAddUserDialog'
import { StaffPage, StaffQueryState } from '../components/StaffPage'
import { StaffDirectoryActions, StaffDirectoryStatus, StaffUserIcon } from '../components/StaffUserDirectoryControls'
import { StaffRoleDialog } from '../components/StaffRoleDialog'
import { StaffLecturerNamesDialog } from '../components/StaffLecturerNamesDialog'
import { lecturerLanguageQuery } from '../../keys/lecturer-display.queries'
import { adminLecturerNamesQuery, refreshLecturerOptions, saveLecturerNames, type LecturerNames } from '../staff-lecturer-names'
import { staffRoleOptionsQuery, staffUserDirectoryQuery, staffUserKeys } from '../staff-user.queries'
import { addStaffUser, removeStaffUser, setStaffUserRoles, setStaffUserStatus, updateStaffUserProfile } from '../staff-user.service'
import type { StaffRegisteredUser, StaffUserDirectoryItem } from '../types/staff-user.types'
import { filterUserDirectory, getStaffInitials, userDirectoryStats } from '../utils/staff-user-directory'
import './StaffUserManagement.css'

const PAGE_SIZE = 10

export function StaffUsersPage() {
  const query = useQuery(staffUserDirectoryQuery())
  const lecturerLanguage = useQuery(lecturerLanguageQuery())
  const lecturerNames = useQuery(adminLecturerNamesQuery())
  const roles = useQuery(staffRoleOptionsQuery())
  const client = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('ALL')
  const [accountStatus, setAccountStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<StaffRegisteredUser | null>(null)
  const [editingLecturer, setEditingLecturer] = useState<StaffUserDirectoryItem | null>(null)
  const adding = searchParams.get('dialog') === 'add'
  const [statusAction, setStatusAction] = useState<{ user: StaffRegisteredUser; status: StaffRegisteredUser['accountStatus'] } | null>(null)
  const [removing, setRemoving] = useState<StaffUserDirectoryItem | null>(null)
  const [statusNotice, setStatusNotice] = useState('')
  const users = useMemo(() => query.data ?? [], [query.data])
  const stats = useMemo(() => userDirectoryStats(users), [users])
  const filtered = useMemo(() => filterUserDirectory(users, { search, role, status: accountStatus },
    user => {
      const names = user.roleCodes.includes('TEACHER') ? lecturerNames.data?.get(user.email.trim().toLowerCase()) : undefined
      return [names?.name_th, names?.name_en]
    }), [users, search, role, accountStatus, lecturerNames.data])
  const namesFor = (user: StaffUserDirectoryItem) => user.roleCodes.includes('TEACHER')
    ? lecturerNames.data?.get(user.email.trim().toLowerCase()) : undefined
  const displayName = (user: StaffUserDirectoryItem) => {
    const names = namesFor(user)
    return (lecturerLanguage.data === 'en' ? names?.name_en : names?.name_th) || user.fullName
  }
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => setPage(1), [search, role, accountStatus])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const refresh = () => client.invalidateQueries({ queryKey: staffUserKeys.directory })
  const saveNames = useMutation({
    mutationFn: (names: LecturerNames) => {
      if (!editingLecturer) throw new Error('กรุณาเลือกอาจารย์')
      return saveLecturerNames({ ...names, id: editingLecturer.id, pending: editingLecturer.pendingRegistration === true })
    },
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: adminLecturerNamesQuery().queryKey }), refreshLecturerOptions(client)])
      setEditingLecturer(null)
      setStatusNotice('บันทึกชื่ออาจารย์เรียบร้อยแล้ว')
    },
  })
  const save = useMutation({
    mutationFn: async (input: { firstName:string;lastName:string;roleCodes: string[]; accountStatus: StaffRegisteredUser['accountStatus'] }) => {
      if (!editing) return
      if(input.firstName!==editing.firstName||input.lastName!==editing.lastName)await updateStaffUserProfile({userId:editing.id,firstName:input.firstName,lastName:input.lastName})
      await setStaffUserRoles({ userId: editing.id, roleCodes: input.roleCodes })
      if (input.accountStatus !== editing.accountStatus) await setStaffUserStatus({ userId: editing.id, status: input.accountStatus })
    },
    onSuccess: async () => { await refresh(); setStatusNotice('บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว'); setEditing(null) },
  })
  const closeAdd=()=>setSearchParams({}, { replace:true })
  const addUser = useMutation({ mutationFn: addStaffUser, onSuccess: async () => { await refresh(); closeAdd(); setStatusNotice('เพิ่มผู้ใช้เรียบร้อยแล้ว') } })
  const status = useMutation({ mutationFn: setStaffUserStatus, onSuccess: async (_,input) => { await refresh(); setStatusNotice(input.status==='ACTIVE'?'เปิดใช้งานบัญชีเรียบร้อยแล้ว':input.status==='SUSPENDED'?'ระงับบัญชีเรียบร้อยแล้ว':'ปิดใช้งานบัญชีเรียบร้อยแล้ว'); setStatusAction(null) } })
  const remove = useMutation({
    mutationFn: removeStaffUser,
    onSuccess: async () => {
      await refresh()
      setRemoving(null)
      setStatusNotice('นำผู้ใช้ออกจากระบบเรียบร้อยแล้ว')
    },
  })
  const openStatus = (user: StaffRegisteredUser, nextStatus: StaffRegisteredUser['accountStatus']) => setStatusAction({ user, status: nextStatus })

  return <StaffPage eyebrow="User Management" title="จัดการผู้ใช้งาน" description="จัดการบัญชี บทบาท และสถานะผู้ใช้" hideHeader>
    <div className="staff-user-stats" aria-label="สรุปผู้ใช้งาน">
      <article className="blue"><span className="staff-user-stat-icon"><StaffUserIcon name="users"/></span><div><small>ผู้ใช้ทั้งหมด</small><strong>{stats.total}</strong></div></article>
      <article className="teal"><span className="staff-user-stat-icon"><StaffUserIcon name="check"/></span><div><small>เปิดใช้งาน</small><strong>{stats.active}</strong></div></article>
      <article className="amber"><span className="staff-user-stat-icon"><StaffUserIcon name="pause"/></span><div><small>ระงับบัญชี</small><strong>{stats.suspended}</strong></div></article>
      <article className="slate"><span className="staff-user-stat-icon"><StaffUserIcon name="lock"/></span><div><small>ยังไม่เข้าสู่ระบบ</small><strong>{stats.pending}</strong></div></article>
    </div>
    {statusNotice&&<p className="staff-success-notice" role="status"><StaffUserIcon name="check"/>{statusNotice}</p>}
    <div className="staff-user-filters"><label className="grow">ค้นหาผู้ใช้<span className="staff-user-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรืออีเมล…" /></span></label><SelectField label="บทบาท" value={role} placeholder="ทุกบทบาท" options={[{value:'ALL',label:'ทุกบทบาท'},...(roles.data??[]).map(item=>({value:item.code,label:item.name}))]} onChange={setRole}/><SelectField label="สถานะ" value={accountStatus} placeholder="ทุกสถานะ" options={[{value:'ALL',label:'ทุกสถานะ'},{value:'ACTIVE',label:'เปิดใช้งาน'},{value:'INACTIVE',label:'ปิดใช้งาน'},{value:'SUSPENDED',label:'ระงับใช้งาน'},{value:'PENDING_REGISTRATION',label:'ยังไม่เข้าสู่ระบบ'}]} onChange={setAccountStatus}/></div>
    <StaffQueryState loading={query.isPending || roles.isPending} error={query.error || roles.error} empty={!users.length} emptyText="ยังไม่มีผู้ใช้งานในระบบ">
      {!pageRows.length ? <div className="staff-empty">ไม่พบผู้ใช้ที่ตรงกับตัวกรอง</div> : <section className="staff-user-panel"><header><strong>รายชื่อผู้ใช้งาน</strong><span>แสดง {filtered.length} รายการ</span></header><div className="staff-table-wrap"><table className="staff-table staff-user-table"><thead><tr><th>ชื่อ–นามสกุล / อีเมล</th><th>บทบาท</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{pageRows.map((user) => <tr key={user.id}><td><div className="staff-user-identity"><span aria-hidden="true">{getStaffInitials(displayName(user))}</span><div><strong>{displayName(user) || 'ยังไม่มีชื่อ'}</strong><small>{user.email}</small></div></div></td><td><div className="staff-role-list">{user.roleCodes.length ? user.roleCodes.map((code, index) => <span className="staff-role-badge" data-role={code} key={code}>{user.roleNames[index] || code}</span>) : <span className="staff-role-empty">ยังไม่ได้กำหนด</span>}</div></td><td><StaffDirectoryStatus user={user}/></td><td><StaffDirectoryActions user={user}
        onEdit={item => { save.reset(); setEditing(item) }}
        onStatus={(item, nextStatus) => { status.reset(); openStatus(item, nextStatus) }}
        onRemove={item => { remove.reset(); setRemoving(item) }}
        lecturerNamesReady={Boolean(lecturerNames.data)}
        onEditLecturerName={item => { saveNames.reset(); setEditingLecturer(item) }}/></td></tr>)}</tbody></table></div></section>}
      <nav className="staff-pagination" aria-label="หน้ารายชื่อผู้ใช้"><span>แสดง {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} จาก {filtered.length}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>ก่อนหน้า</button><b>หน้า {page} / {pageCount}</b><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>ถัดไป</button></div></nav>
    </StaffQueryState>
    {editing && <StaffRoleDialog user={editing} roles={roles.data ?? []} pending={save.isPending} error={save.error?.message} onClose={() => setEditing(null)} onSave={(input) => save.mutate(input)}/>} 
    {editingLecturer && <StaffLecturerNamesDialog email={editingLecturer.email} originalName={editingLecturer.fullName}
      names={namesFor(editingLecturer)} pending={saveNames.isPending} error={saveNames.error?.message}
      onClose={() => setEditingLecturer(null)} onSave={names => saveNames.mutate(names)} />}
    {adding && <StaffAddUserDialog roles={roles.data ?? []} pending={addUser.isPending} error={addUser.error?.message} onClose={closeAdd} onSave={(input) => addUser.mutate(input)}/>}
    {removing && <StaffUserActionDialog user={removing} action="REMOVE"
      pending={remove.isPending} error={remove.error?.message}
      onClose={() => { remove.reset(); setRemoving(null) }}
      onConfirm={() => remove.mutate(removing)}
    />}
    {statusAction && <StaffUserActionDialog user={statusAction.user} action={statusAction.status}
      pending={status.isPending} error={status.error?.message}
      onClose={() => { status.reset(); setStatusAction(null) }}
      onConfirm={() => status.mutate({ userId: statusAction.user.id, status: statusAction.status })}
    />}
  </StaffPage>
}
